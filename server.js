const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'troque_essa_chave_no_railway';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Sem token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.userId = data.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// --- API ---
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash: hash } });
    const token = signToken(user.id);
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Credenciais inválidas' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Credenciais inválidas' });
  const token = signToken(user.id);
  res.json({ token });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, nick: true, avatar: true, createdAt: true }
  });
  res.json(user);
});

app.post('/api/profile', authMiddleware, async (req, res) => {
  const { nick, avatar } = req.body;
  if (!nick) return res.status(400).json({ error: 'Nick obrigatório' });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { nick, avatar },
    select: { id: true, email: true, nick: true, avatar: true }
  });
  res.json(user);
});

app.get('/api/messages', authMiddleware, async (req, res) => {
  const messages = await prisma.message.findMany({
    take: 100,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, nick: true, avatar: true } } }
  });
  res.json(messages);
});

// --- Socket.IO ---
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('no token'));
  try {
    const data = jwt.verify(token, JWT_SECRET);
    socket.userId = data.userId;
    next();
  } catch {
    next(new Error('invalid'));
  }
});

io.on('connection', async (socket) => {
  const user = await prisma.user.findUnique({ where: { id: socket.userId } });
  if (!user || !user.nick) {
    socket.disconnect();
    return;
  }

  onlineUsers.set(socket.userId, {
    id: user.id,
    nick: user.nick,
    avatar: user.avatar,
    socketId: socket.id
  });

  io.emit('online_users', Array.from(onlineUsers.values()));

  socket.on('send_message', async ({ content }) => {
    if (!content?.trim()) return;
    const msg = await prisma.message.create({
      data: { content: content.slice(0, 1000), userId: user.id },
      include: { user: { select: { id: true, nick: true, avatar: true } } }
    });
    io.emit('new_message', {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      user: msg.user
    });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('online_users', Array.from(onlineUsers.values()));
  });
});

server.listen(PORT, () => {
  console.log('Chat rodando na porta', PORT);
});