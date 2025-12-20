# CRITICAL: USER ROLES - NEVER CHANGE

## ONLY TWO ROLES ALLOWED:
1. ADMIN
2. USER

## NO OTHER ROLES:
- ❌ TECHNICIAN
- ❌ CASHIER
- ❌ MANAGER
- ❌ MEMBER
- ❌ Any other role

## SCHEMA:
```prisma
enum UserRole {
  ADMIN
  USER
}
```

## VALIDATION:
```typescript
role: z.enum(['ADMIN', 'USER'])
```

## REMEMBER FOREVER:
- Saya (user) telah beritahu berulang kali: Hanya ADMIN dan USER
- Jangan pernah tukar atau tambah role lain
- Pastikan semua code menggunakan hanya ADMIN dan USER
- Jika ada role lain dalam code, ia adalah salah!