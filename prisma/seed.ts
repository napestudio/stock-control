import { PermissionKey, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting seed...");

  // 1. Create Permissions
  console.log("Creating permissions...");
  const permissions = await Promise.all(
    Object.values(PermissionKey).map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          label: key.replace(/_/g, " ").toLowerCase(),
        },
      }),
    ),
  );
  console.log(`Created ${permissions.length} permissions`);

  // 2. Create Admin Role with all permissions
  console.log("Creating admin role...");
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      description: "Administrador con todos los permisos",
      permissions: {
        create: permissions.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
  });
  console.log("Admin role created");

  // 3. Create Cashier Role with limited permissions
  console.log("Creating cashier role...");
  const cashierKeys: PermissionKey[] = [
    PermissionKey.CREATE_SALE,
    PermissionKey.VIEW_SALES,
    PermissionKey.OPEN_CASH,
    PermissionKey.CLOSE_CASH,
  ];
  const cashierPermissions = permissions.filter((p) =>
    cashierKeys.includes(p.key),
  );

  await prisma.role.upsert({
    where: { name: "Cajero" },
    update: {},
    create: {
      name: "Cajero",
      description: "Cajero con permisos limitados",
      permissions: {
        create: cashierPermissions.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
  });
  console.log("Cashier role created");

  // 4. Create Admin User
  console.log("Creating admin user...");
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@stockcontrol.com" },
    update: {},
    create: {
      email: "admin@stockcontrol.com",
      name: "Administrador",
      password: hashedPassword,
      active: true,
      roleId: adminRole.id,
    },
  });
  console.log("Admin user created");
  console.log("Email: admin@stockcontrol.com");
  console.log("Password: admin123");

  // 5. Create a Cash Register (useful for testing)
  console.log("Creating default cash register...");
  await prisma.cashRegister.upsert({
    where: { id: "default-cash-register" },
    update: {},
    create: {
      id: "default-cash-register",
      name: "Caja Principal",
      active: true,
    },
  });
  console.log("Cash register created");

  console.log("Seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
