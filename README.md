# POS & Sistema de Inventario

Este proyecto está construido con un stack moderno y optimizado para alto rendimiento:

- **Next.js (última versión, App Router)**
- **pnpm**
- **Prisma ORM**
- **PostgreSQL**

La arquitectura está pensada para ser escalable, rápida y con un modelo de datos sólido.

---

## Requisitos

- Node.js 18 o superior
- pnpm
- Docker + Docker Compose

---

## Base de datos (PostgreSQL con Docker)

El proyecto incluye un archivo `docker-compose.yml` para levantar la base de datos localmente.

### Levantar la base de datos

Desde la raíz del proyecto:

```bash
docker compose up -d
```

## Prisma

Asegurate de que el archivo .env tenga definida la variable DATABASE_URL.

Luego ejecutá:

```bash
npx prisma generate
```
