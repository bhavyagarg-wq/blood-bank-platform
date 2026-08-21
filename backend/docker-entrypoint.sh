#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  users=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(n=>{console.log(n);return p.\$disconnect();}).catch(()=>{console.log('error');process.exit(1);})")
  if [ "$users" = "0" ]; then
    echo "No users found, seeding demo data"
    npm run seed
  else
    echo "Database already has $users users, skipping seed"
  fi
fi

exec node dist/src/index.js
