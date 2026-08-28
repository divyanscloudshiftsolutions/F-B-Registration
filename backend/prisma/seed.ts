import { PrismaClient, Station, FoodType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Initialization & Seeding ---');

  // Transaction data deletion removed to prevent data loss.
  console.log('Skipping transactional table deletion for safety.');

  // 1. Create triggers in PostgreSQL database using raw SQL
  console.log('Creating triggers...');

  const creationTriggerFunction = `
    CREATE OR REPLACE FUNCTION update_table_on_token_creation()
    RETURNS TRIGGER AS $$
    BEGIN
        UPDATE tables 
        SET status = 'occupied',
            current_token_id = NEW.id,
            occupied_since = NEW.start_time,
            last_assigned_at = NEW.start_time,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.table_id;
        
        INSERT INTO table_occupancy_logs (id, table_id, token_id, occupied_at)
        VALUES (gen_random_uuid(), NEW.table_id, NEW.id, NEW.start_time);
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  const closeTriggerFunction = `
    CREATE OR REPLACE FUNCTION update_table_on_token_close()
    RETURNS TRIGGER AS $$
    BEGIN
        IF OLD.status != 'closed' AND NEW.status = 'closed' THEN
            UPDATE tables 
            SET status = 'available',
                current_token_id = NULL,
                occupied_since = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.table_id AND current_token_id = NEW.id;
            
            UPDATE table_occupancy_logs 
            SET vacated_at = NEW.closed_at
            WHERE table_id = NEW.table_id AND token_id = NEW.id AND vacated_at IS NULL;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await prisma.$executeRawUnsafe(creationTriggerFunction);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trigger_update_table_on_token_creation ON tokens;`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trigger_update_table_on_token_creation
    AFTER INSERT ON tokens
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION update_table_on_token_creation();
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trigger_update_table_on_token_close ON tokens;`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS update_table_on_token_close();`);

  console.log('Triggers successfully installed.');

  // Create partial unique indexes and check constraints
  console.log('Creating unique indexes and check constraints...');
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS uq_customer_active_token;`);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX uq_customer_active_token 
    ON tokens(customer_id) 
    WHERE status IN ('ACTIVE', 'EXTENDED');
  `);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS uq_table_active_token;`);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX uq_table_active_token 
    ON tokens(table_id) 
    WHERE status IN ('ACTIVE', 'EXTENDED');
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE tables DROP CONSTRAINT IF EXISTS chk_table_capacity;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tables ADD CONSTRAINT chk_table_capacity CHECK (capacity BETWEEN 1 AND 20);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_persons_count_check;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens ADD CONSTRAINT tokens_persons_count_check CHECK (persons_count BETWEEN 1 AND 20);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_redemptions_used_check;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens ADD CONSTRAINT tokens_redemptions_used_check CHECK (redemptions_used <= total_redemptions_allowed);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE place_types DROP CONSTRAINT IF EXISTS chk_rate_non_negative;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE place_types ADD CONSTRAINT chk_rate_non_negative CHECK (rate_per_person >= 0);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens DROP CONSTRAINT IF EXISTS chk_amount_paid_non_negative;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tokens ADD CONSTRAINT chk_amount_paid_non_negative CHECK (amount_paid >= 0);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE token_extensions DROP CONSTRAINT IF EXISTS chk_additional_amount_non_negative;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE token_extensions ADD CONSTRAINT chk_additional_amount_non_negative CHECK (additional_amount >= 0);
  `);

  // 2. Seed Roles
  console.log('Seeding roles...');
  const roleSpecs = [
    {
      name: 'admin',
      permissions: {
        create_token: true,
        extend_token: true,
        close_token: true,
        view_tables: true,
        process_redemption: true,
        manage_rates: true,
        manage_menu: true,
        manage_orders: true,
      },
    },
    {
      name: 'receptionist',
      permissions: {
        create_token: true,
        extend_token: true,
        close_token: true,
        view_tables: true,
      },
    },
    {
      name: 'bartender',
      permissions: {
        process_redemption: true,
        view_tokens: true,
        process_kds_bar: true,
      },
    },
    {
      name: 'manager',
      permissions: {
        view_tables: true,
        view_tokens: true,
        view_reports: true,
        manage_menu: true,
      },
    },
  ];

  const dbRoles: Record<string, string> = {};
  for (const role of roleSpecs) {
    const createdRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
    dbRoles[role.name] = createdRole.id;
  }
  console.log('Roles seeded.');

  // 3. Seed Users
  console.log('Seeding users...');
  const userSpecs = [
    {
      username: 'admin',
      fullName: 'Divyan',
      passwordHash: await bcrypt.hash('admin123', 12),
      roleId: dbRoles['admin'],
      isActive: true,
    },
    {
      username: 'receptionist',
      fullName: 'Sarah Receptionist',
      passwordHash: await bcrypt.hash('recep123', 12),
      roleId: dbRoles['receptionist'],
      isActive: true,
    },
    {
      username: 'bartender',
      fullName: 'John Bartender',
      passwordHash: await bcrypt.hash('bar123', 12),
      roleId: dbRoles['bartender'],
      isActive: true,
    },
    {
      username: 'manager',
      fullName: 'David Manager',
      passwordHash: await bcrypt.hash('manager123', 12),
      roleId: dbRoles['manager'],
      isActive: true,
    },
  ];

  for (const u of userSpecs) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        passwordHash: u.passwordHash,
        roleId: u.roleId,
        isActive: u.isActive,
      },
      create: u,
    });
  }
  console.log('Users seeded.');

  // 4. Seed Place Types Config
  console.log('Seeding place types...');
  const placeTypeSpecs = [
    {
      name: 'STANDING_BAR',
      ratePerPerson: 500.0,
      baseTimeMinutes: 30,
      redemptionsPerPerson: 2,
      isActive: true,
    },
    {
      name: 'PREMIUM_LOUNGE',
      ratePerPerson: 1200.0,
      baseTimeMinutes: 30,
      redemptionsPerPerson: 3,
      isActive: true,
    },
  ];

  const dbPlaceTypes: Record<string, string> = {};
  for (const pt of placeTypeSpecs) {
    const createdPt = await prisma.placeTypeConfig.upsert({
      where: { name: pt.name },
      update: pt,
      create: pt,
    });
    dbPlaceTypes[pt.name] = createdPt.id;
  }
  console.log('Place types seeded.');

  // 5. Seed Tables
  console.log('Seeding tables...');
  const seatCapacities = [2, 4, 6];

  // Standard tables S-01 to S-15
  for (let i = 1; i <= 15; i++) {
    const tableNumber = `S-${String(i).padStart(2, '0')}`;
    const capacity = seatCapacities[(i - 1) % seatCapacities.length];
    await prisma.table.upsert({
      where: {
        tableNumber_placeTypeId: {
          tableNumber,
          placeTypeId: dbPlaceTypes['STANDING_BAR'],
        },
      },
      update: {
        capacity,
        status: 'available',
        isActive: true,
      },
      create: {
        tableNumber,
        placeTypeId: dbPlaceTypes['STANDING_BAR'],
        capacity,
        status: 'available',
        isActive: true,
      },
    });
  }

  // Premium tables L-01 to L-10
  for (let i = 1; i <= 10; i++) {
    const tableNumber = `L-${String(i).padStart(2, '0')}`;
    const capacity = seatCapacities[(i - 1) % seatCapacities.length];
    await prisma.table.upsert({
      where: {
        tableNumber_placeTypeId: {
          tableNumber,
          placeTypeId: dbPlaceTypes['PREMIUM_LOUNGE'],
        },
      },
      update: {
        capacity,
        status: 'available',
        isActive: true,
      },
      create: {
        tableNumber,
        placeTypeId: dbPlaceTypes['PREMIUM_LOUNGE'],
        capacity,
        status: 'available',
        isActive: true,
      },
    });
  }
  console.log('Tables seeded.');

  // 6. Seed System Configurations
  console.log('Seeding system configs...');
  await prisma.systemConfig.upsert({
    where: { configKey: 'email_qr_enabled' },
    update: {},
    create: {
      configKey: 'email_qr_enabled',
      configValue: 'true',
    },
  });
  console.log('System configs seeded.');

  // ==========================================
  // 7. SEED MENU SECTIONS, CATEGORIES & ITEMS
  // ==========================================
  console.log('Seeding menu sections and catalog...');

  const sectionSpecs = [
    { name: 'Eat', slug: 'eat', sortOrder: 1 },
    { name: 'Drink', slug: 'drink', sortOrder: 2 },
    { name: 'Merchandise', slug: 'merchandise', sortOrder: 3 },
  ];

  const dbSections: Record<string, string> = {};
  for (const s of sectionSpecs) {
    const created = await prisma.menuSection.upsert({
      where: { slug: s.slug },
      update: { name: s.name, sortOrder: s.sortOrder },
      create: s,
    });
    dbSections[s.slug] = created.id;
  }

  const categorySpecs = [
    // Eat
    { sectionSlug: 'eat', name: 'Bar Snacks', slug: 'bar-snacks', sortOrder: 1 },
    { sectionSlug: 'eat', name: 'Burgers & Sandwiches', slug: 'burgers', sortOrder: 2 },
    { sectionSlug: 'eat', name: 'Mains', slug: 'mains', sortOrder: 3 },
    { sectionSlug: 'eat', name: 'Accompaniments', slug: 'sides', sortOrder: 4 },
    { sectionSlug: 'eat', name: 'Desserts', slug: 'desserts', sortOrder: 5 },
    // Drink
    { sectionSlug: 'drink', name: 'Beer', slug: 'beer', sortOrder: 1 },
    { sectionSlug: 'drink', name: 'Whisky', slug: 'whisky', sortOrder: 2 },
    { sectionSlug: 'drink', name: 'Cocktails', slug: 'cocktails', sortOrder: 3 },
    { sectionSlug: 'drink', name: 'Mocktails', slug: 'mocktails', sortOrder: 4 },
    { sectionSlug: 'drink', name: 'Wine', slug: 'wine', sortOrder: 5 },
    { sectionSlug: 'drink', name: 'Soft Drinks & Water', slug: 'soft', sortOrder: 6 },
    // Merch
    { sectionSlug: 'merchandise', name: 'Take Home', slug: 'take-home', sortOrder: 1 },
  ];

  const dbCategories: Record<string, string> = {};
  for (const c of categorySpecs) {
    const created = await prisma.menuCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder, sectionId: dbSections[c.sectionSlug] },
      create: { name: c.name, slug: c.slug, sortOrder: c.sortOrder, sectionId: dbSections[c.sectionSlug] },
    });
    dbCategories[c.slug] = created.id;
  }

  // Subcategories
  const subcategorySpecs = [
    { categorySlug: 'bar-snacks', name: 'Vegetarian', slug: 'veg', sortOrder: 1 },
    { categorySlug: 'bar-snacks', name: 'Chicken', slug: 'chicken', sortOrder: 2 },
    { categorySlug: 'bar-snacks', name: 'Seafood', slug: 'seafood', sortOrder: 3 },
  ];

  const dbSubcategories: Record<string, string> = {};
  for (const sc of subcategorySpecs) {
    const existing = await prisma.menuSubcategory.findFirst({
      where: { categoryId: dbCategories[sc.categorySlug], slug: sc.slug },
    });
    if (existing) {
      dbSubcategories[sc.slug] = existing.id;
    } else {
      const created = await prisma.menuSubcategory.create({
        data: {
          categoryId: dbCategories[sc.categorySlug],
          name: sc.name,
          slug: sc.slug,
          sortOrder: sc.sortOrder,
        },
      });
      dbSubcategories[sc.slug] = created.id;
    }
  }

  // Menu Items & Modifiers
  const menuItemSpecs = [
    {
      id: 'itm_gcc',
      name: 'Golf Club Cauliflower',
      description: 'Crisp cauliflower tossed in signature honey-chilli glaze',
      sectionId: dbSections['eat'],
      categoryId: dbCategories['bar-snacks'],
      subcategoryId: dbSubcategories['veg'],
      foodType: FoodType.VEG,
      basePrice: 215.0,
      station: Station.KITCHEN,
      isAvailable: true,
      isPopular: true,
      tags: ['snack', 'spicy'],
      preparationTime: 12,
      variants: [
        { name: 'Half', priceDelta: 0.0, sortOrder: 1 },
        { name: 'Full', priceDelta: 100.0, sortOrder: 2 },
      ],
      modifierGroup: {
        name: 'Spice level',
        isRequired: false,
        isMulti: false,
        options: [
          { name: 'Mild', priceDelta: 0.0 },
          { name: 'Medium', priceDelta: 0.0 },
          { name: 'Hot', priceDelta: 0.0 },
        ],
      },
    },
    {
      id: 'itm_wings',
      name: 'Chicken Wings',
      description: 'Slow-cooked wings in smoky BBQ glaze',
      sectionId: dbSections['eat'],
      categoryId: dbCategories['bar-snacks'],
      subcategoryId: dbSubcategories['chicken'],
      foodType: FoodType.NON_VEG,
      basePrice: 220.0,
      station: Station.KITCHEN,
      isAvailable: true,
      isFeatured: true,
      isPopular: true,
      tags: ['signature'],
      preparationTime: 14,
      variants: [
        { name: 'Half', priceDelta: 0.0, sortOrder: 1 },
        { name: 'Full', priceDelta: 170.0, sortOrder: 2 },
      ],
      modifierGroup: {
        name: 'Spice level',
        isRequired: false,
        isMulti: false,
        options: [
          { name: 'Mild', priceDelta: 0.0 },
          { name: 'Medium', priceDelta: 0.0 },
          { name: 'Hot', priceDelta: 0.0 },
        ],
      },
    },
    {
      id: 'itm_bira',
      name: 'Bira 91 White Draft',
      description: 'Low bitterness wheat beer with citrus & coriander notes',
      sectionId: dbSections['drink'],
      categoryId: dbCategories['beer'],
      foodType: FoodType.VEG,
      basePrice: 275.0,
      station: Station.BAR,
      isAvailable: true,
      isPopular: true,
      tags: ['craft', 'tap'],
      preparationTime: 3,
      variants: [
        { name: 'Pint (330ml)', priceDelta: 0.0, sortOrder: 1 },
        { name: 'Pitcher (1500ml)', priceDelta: 550.0, sortOrder: 2 },
      ],
      modifierGroup: {
        name: 'Ice',
        isRequired: false,
        isMulti: false,
        options: [
          { name: 'Chilled Glass', priceDelta: 0.0 },
          { name: 'With Ice', priceDelta: 0.0 },
        ],
      },
    },
    {
      id: 'itm_oldmonk',
      name: 'Old Monk Legend Rum',
      description: 'Iconic dark rum aged in oak vats',
      sectionId: dbSections['drink'],
      categoryId: dbCategories['whisky'],
      foodType: FoodType.VEG,
      basePrice: 190.0,
      station: Station.BAR,
      isAvailable: true,
      tags: ['spirit'],
      preparationTime: 2,
      variants: [
        { name: '30ml (Single)', priceDelta: 0.0, sortOrder: 1 },
        { name: '60ml (Double)', priceDelta: 160.0, sortOrder: 2 },
      ],
      modifierGroup: {
        name: 'Mixer',
        isRequired: false,
        isMulti: false,
        options: [
          { name: 'Water', priceDelta: 0.0 },
          { name: 'Soda', priceDelta: 30.0 },
          { name: 'Cola', priceDelta: 40.0 },
        ],
      },
    },
  ];

  for (const item of menuItemSpecs) {
    const createdItem = await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        sectionId: item.sectionId,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        foodType: item.foodType,
        basePrice: item.basePrice,
        station: item.station,
        isAvailable: item.isAvailable,
        isFeatured: item.isFeatured ?? false,
        isPopular: item.isPopular ?? false,
        tags: item.tags,
        preparationTime: item.preparationTime,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        sectionId: item.sectionId,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        foodType: item.foodType,
        basePrice: item.basePrice,
        station: item.station,
        isAvailable: item.isAvailable,
        isFeatured: item.isFeatured ?? false,
        isPopular: item.isPopular ?? false,
        tags: item.tags,
        preparationTime: item.preparationTime,
      },
    });

    // Seed variants
    for (const v of item.variants) {
      const existingVar = await prisma.itemVariant.findFirst({
        where: { menuItemId: createdItem.id, name: v.name },
      });
      if (!existingVar) {
        await prisma.itemVariant.create({
          data: { menuItemId: createdItem.id, name: v.name, priceDelta: v.priceDelta, sortOrder: v.sortOrder },
        });
      }
    }

    // Seed modifier group
    if (item.modifierGroup) {
      let existingGroup = await prisma.modifierGroup.findFirst({
        where: { menuItemId: createdItem.id, name: item.modifierGroup.name },
      });
      if (!existingGroup) {
        existingGroup = await prisma.modifierGroup.create({
          data: {
            menuItemId: createdItem.id,
            name: item.modifierGroup.name,
            isRequired: item.modifierGroup.isRequired,
            isMulti: item.modifierGroup.isMulti,
          },
        });
      }
      for (const opt of item.modifierGroup.options) {
        const existingOpt = await prisma.modifierOption.findFirst({
          where: { groupId: existingGroup.id, name: opt.name },
        });
        if (!existingOpt) {
          await prisma.modifierOption.create({
            data: { groupId: existingGroup.id, name: opt.name, priceDelta: opt.priceDelta },
          });
        }
      }
    }
  }
  console.log('Menu items & customizer modifiers seeded.');

  // 8. Seed Promotions
  console.log('Seeding promotions...');
  const promoSpecs = [
    {
      id: 'prm_weekend',
      title: 'Weekend Craft Tap Takeover',
      subtitle: 'Flat 15% off on all craft beer pitchers',
      ctaLabel: 'Order Craft Pitchers',
      ctaTarget: '/customer/drink?cat=beer',
      accent: 'amber',
      isActive: true,
      discountPercent: 15.0,
    },
    {
      id: 'prm_lounge',
      title: 'Lounge Happy Hours',
      subtitle: 'Buy 2 cocktails, get Chef Bar Snack free',
      ctaLabel: 'Explore Cocktails',
      ctaTarget: '/customer/drink?cat=cocktails',
      accent: 'bottle',
      isActive: true,
    },
  ];

  for (const promo of promoSpecs) {
    await prisma.promotion.upsert({
      where: { id: promo.id },
      update: promo,
      create: promo,
    });
  }
  console.log('Promotions seeded.');

  console.log('--- Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
