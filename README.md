# Railway Chat - Multiusuário

Chat web completo para hospedar na Railway, sem Google.

## Funcionalidades
- Login com e-mail e senha
- Após login, escolhe Nick e foto (upload)
- Histórico salvo no PostgreSQL
- Lista de usuários online em tempo real
- Totalmente responsivo (celular e desktop)
- Socket.IO para mensagens instantâneas

## Stack
- Backend: Node.js, Express, Socket.IO, Prisma
- Banco: PostgreSQL (plugin da Railway)
- Frontend: HTML/CSS/JS vanilla

## Como subir na Railway

1. Crie um novo projeto na Railway
2. Adicione plugin **PostgreSQL**
3. Faça deploy deste repositório (ou faça upload do zip)
4. Nas variáveis, defina:
   - `JWT_SECRET` = uma string aleatória longa
   - `DATABASE_URL` = já vem do plugin Postgres
5. Deploy. A Railway vai rodar `npx prisma migrate deploy` automaticamente.

## Rodando local
```bash
npm install
cp .env.example .env
# edite DATABASE_URL para seu Postgres local
npx prisma migrate dev
npm start
```

Acesse http://localhost:3000

## Estrutura
- `/server.js` - API + Socket.IO
- `/prisma/schema.prisma` - User e Message
- `/public` - frontend completo

Pronto para usar no celular: abra no navegador, faça login, escolha nick e foto.