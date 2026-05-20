const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import seeding data
const languages = [
  { name: 'English', sortOrder: 1 },
  { name: 'Chinese', sortOrder: 2 },
  { name: 'Spanish', sortOrder: 3 },
  { name: 'Hindi', sortOrder: 4 },
  { name: 'Arabic', sortOrder: 5 },
  { name: 'Portuguese', sortOrder: 6 },
  { name: 'Bengali', sortOrder: 7 },
  { name: 'Russian', sortOrder: 8 },
  { name: 'Japanese', sortOrder: 9 },
  { name: 'Punjabi', sortOrder: 10 },
  { name: 'German', sortOrder: 11 },
  { name: 'French', sortOrder: 12 },
  { name: 'Urdu', sortOrder: 13 },
  { name: 'Indonesian', sortOrder: 14 },
  { name: 'Italian', sortOrder: 15 },
  { name: 'Turkish', sortOrder: 16 },
  { name: 'Vietnamese', sortOrder: 17 },
  { name: 'Persian', sortOrder: 18 },
  { name: 'Thai', sortOrder: 19 },
  { name: 'Korean', sortOrder: 20 },
  { name: 'Tamil', sortOrder: 21 },
  { name: 'Swahili', sortOrder: 22 },
  { name: 'Marathi', sortOrder: 23 },
  { name: 'Telugu', sortOrder: 24 },
  { name: 'Gujarati', sortOrder: 25 },
  { name: 'Polish', sortOrder: 26 },
  { name: 'Ukrainian', sortOrder: 27 },
  { name: 'Malayalam', sortOrder: 28 },
  { name: 'Romanian', sortOrder: 29 },
  { name: 'Dutch', sortOrder: 30 },
  { name: 'Hungarian', sortOrder: 31 },
  { name: 'Greek', sortOrder: 32 },
  { name: 'Czech', sortOrder: 33 },
  { name: 'Swedish', sortOrder: 34 },
  { name: 'Tagalog', sortOrder: 35 },
  { name: 'Kazakh', sortOrder: 36 },
  { name: 'Danish', sortOrder: 37 },
  { name: 'Slovak', sortOrder: 38 },
  { name: 'Slovenian', sortOrder: 39 },
  { name: 'Serbian', sortOrder: 40 },
  { name: 'Finnish', sortOrder: 41 },
  { name: 'Bulgarian', sortOrder: 42 },
  { name: 'Norwegian', sortOrder: 43 },
  { name: 'Macedonian', sortOrder: 44 },
  { name: 'Lithuanian', sortOrder: 45 },
  { name: 'Latvian', sortOrder: 46 },
  { name: 'Croatian', sortOrder: 47 },
  { name: 'Somali', sortOrder: 48 },
  { name: 'Albanian', sortOrder: 49 },
  { name: 'Armenian', sortOrder: 50 },
  { name: 'Bosnian', sortOrder: 51 },
  { name: 'Georgian', sortOrder: 52 },
  { name: 'Amharic', sortOrder: 53 },
  { name: 'Burmese', sortOrder: 54 },
  { name: 'Malay', sortOrder: 55 },
  { name: 'Estonian', sortOrder: 56 },
  { name: 'Catalan', sortOrder: 57 },
  { name: 'Mongolian', sortOrder: 58 },
  { name: 'Kannada', sortOrder: 59 },
];

const categories = [
  { name: 'Canned Goods', limit: 10, icon: 'cylinder' },
  { name: 'Beans', limit: 10, icon: 'bean' },
  { name: 'Produce', limit: 100, icon: 'apple' },
  { name: 'Meats', limit: 1, limitType: 'household', icon: 'drumstick' },
  { name: 'Frozen', limit: 3, icon: 'snowflake' },
  { name: 'Dry Goods', limit: 10, icon: 'package-2' },
  { name: 'Dairy', limit: 3, icon: 'glass-water' },
  { name: 'Hygiene Items', limit: 5, icon: 'bath' }
];

const foodItems = [
  // Canned Goods
  { name: 'Tuna', limit: 1, categoryName: 'Canned Goods', isLimited: true, vegan: false, vegetarian: false, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Sweet Potato Pie Mix', limit: 3, categoryName: 'Canned Goods', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Tomato Sauce/Diced Tomato', limit: 1, categoryName: 'Canned Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'White Hominy', limit: 1, categoryName: 'Canned Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Tomato Paste', limit: 3, categoryName: 'Canned Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Collard Greens', limit: 3, categoryName: 'Canned Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Organic Pumpkin Pie Mix', limit: 5, categoryName: 'Canned Goods', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: true, halal: true, kosher: true, readyToEat: false },
  { name: 'Pumpkin Puree', limit: 5, categoryName: 'Canned Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Evaporated Milk', limit: 1, categoryName: 'Canned Goods', isLimited: true, vegan: false, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },

  // Beans
  { name: 'Pinto Beans (dried)', limit: 1, categoryName: 'Beans', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Lentils (dried)', limit: 1, categoryName: 'Beans', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Black Turtle Beans (canned)', limit: 2, categoryName: 'Beans', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Navy Beans (dried)', limit: 1, categoryName: 'Beans', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },

  // Produce
  { name: 'Fresh Herbs', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Green Grapes', limit: 1, categoryName: 'Produce', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Carrots', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Kale', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: true, halal: true, kosher: true, readyToEat: true },
  { name: 'Apples', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Yellow Squash', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Salad Greens', limit: 2, categoryName: 'Produce', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Rutabaga', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Tomatoes', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Asian Pears', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Avocado', limit: 100, categoryName: 'Produce', isLimited: false, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },

  // Meats
  { name: 'Chicken', limit: 1, categoryName: 'Meats', isLimited: true, limitType: 'household', vegan: false, vegetarian: false, glutenFree: true, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Ham Steak (precooked)', limit: 1, categoryName: 'Meats', isLimited: true, limitType: 'household', vegan: false, vegetarian: false, glutenFree: true, organic: false, halal: false, kosher: false, readyToEat: true },

  // Frozen
  { name: 'Frozen Carrots', limit: 2, categoryName: 'Frozen', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Multigrain Rolls', limit: 1, categoryName: 'Frozen', isLimited: true, vegan: false, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Frozen Pasta Dinner', limit: 1, categoryName: 'Frozen', isLimited: true, vegan: false, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: true },

  // Dry Goods
  { name: 'Masa (Corn Flour)', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Tomato & Red Pepper Soup', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Rice', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Chips', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Mac n Cheese', limit: 5, categoryName: 'Dry Goods', isLimited: true, vegan: false, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Peanut Butter', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Bread', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: false, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Cooking Oil', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Powdered Sugar', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Picante Hot Sauce', limit: 4, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Potato Flakes', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },
  { name: 'Shelf Stable Milk', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: false, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Raisin Snack Pack', limit: 5, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Mini Toast Crackers', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: false, vegetarian: true, glutenFree: false, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Coca-Cola', limit: 1, categoryName: 'Dry Goods', isLimited: true, limitType: 'person', vegan: true, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Flax Meal', limit: 1, categoryName: 'Dry Goods', isLimited: true, vegan: true, vegetarian: true, glutenFree: true, organic: true, halal: true, kosher: true, readyToEat: false },

  // Dairy
  { name: 'Coffee Creamer', limit: 1, categoryName: 'Dairy', isLimited: true, vegan: false, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: true },
  { name: 'Eggs', limit: 1, categoryName: 'Dairy', isLimited: true, vegan: false, vegetarian: true, glutenFree: true, organic: false, halal: true, kosher: true, readyToEat: false },

  // Hygiene Items
  { name: 'Baby Formula', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Laxative', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Deodorant', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Sleep Aid/Unisom', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Hygiene Kit', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Tampons/Pads', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Toilet Paper', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Laundry Soap', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'First Aid Kit', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Bar Soap', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Razor', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Wet Cat Food', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: true },
  { name: 'Toothbrush', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false },
  { name: 'Toothpaste', limit: 1, categoryName: 'Hygiene Items', isLimited: true, vegan: false, vegetarian: false, glutenFree: false, organic: false, halal: false, kosher: false, readyToEat: false }
];

const systemPrompts = [
  {
    name: 'Shopping List Auto-Format',
    promptType: 'CLASSIFICATION',
    isActive: true,
    isDefault: false,
    description: 'Customized for William Temple House shopping lists',
    skipTranslation: 'Titles like  "Shopping List", "Client Name", placeholders like "____".',
    includeEnglish: 'Food items names such as "Kidney beans", "Apples", "Beef", "Eggs", or "Chicken Noodle Soup". Hygiene items like "Toothpaste", "Soap", "First Aid Kit", "Hygiene Kit." Exclude categories names like "Hygiene Items" "Beans" "Dairy". Exclude header names "Limit", "Quantity".',
    skipTranslationThreshold: 0.8,
    includeEnglishThreshold: 0.7,
    rememberFormattingChoices: true
  },
  {
    name: 'DOCX - Low Temp',
    promptType: 'BATCH_TRANSLATION',
    isActive: true,
    isDefault: false,
    description: 'Detailed translation instructions for DOCX files. Stable output',
    serviceDescription: 'You are a translator service.',
    translationApproach: 'Translate with the expectations of native speakers in mind, be culturally sensitive, and apply natural language.',
    contextGuidance: 'In the context of a social services agency offering food pantry, emergency clothing, and hygiene.',
    additionalGuidance: 'Do NOT provide any commentary about the translations. Do not request additional feedback. Always make your best guess when in doubt.',
    temperature: 0.3,
    topP: 1
  },
  {
    name: 'Food Items and Categories',
    promptType: 'FOOD_TRANSLATION',
    isActive: true,
    isDefault: false,
    description: 'Customized for William Temple House food inventory',
    serviceDescription: 'You are a translator service.',
    translationApproach: 'Translate with the expectations of native speakers in mind, be culturally sensitive, and apply natural language.',
    contextGuidance: 'In the context of a social services agency offering food pantry, emergency clothing, and hygiene items.',
    additionalGuidance: 'Do NOT provide any commentary about the translations. Do not request additional feedback. Always make your best guess when in doubt.',
    temperature: 1,
    topP: 1,
    rememberFormattingChoices: true
  }
];

// Language seeding function
async function seedLanguages() {
  console.log('Starting language seeding...');

  for (const language of languages) {
    await prisma.language.upsert({
      where: { name: language.name },
      update: { 
        sortOrder: language.sortOrder,
        // Enable English and Russian by default
        isEnabled: language.name === 'English' || language.name === 'Russian'
      },
      create: {
        name: language.name,
        sortOrder: language.sortOrder,
        isEnabled: language.name === 'English' || language.name === 'Russian'
      }
    });
  }

  console.log('Language seeding completed.');
  
  // Verify that Russian is enabled
  const russian = await prisma.language.findUnique({
    where: { name: 'Russian' }
  });
  
  console.log('Russian language status:', {
    name: russian?.name,
    isEnabled: russian?.isEnabled
  });
  
  // Count enabled languages
  const enabledCount = await prisma.language.count({
    where: { isEnabled: true }
  });
  
  console.log(`Total enabled languages: ${enabledCount}`);
}

// Global limit seeding function
async function seedGlobalLimit() {
  console.log('Setting global limit...');
  
  await prisma.globalLimit.upsert({
    where: { id: 1 },
    update: { value: 10 },
    create: { id: 1, value: 10 }
  });
  
  console.log('Global limit set to 10.');
}

// Category seeding function
async function seedCategories() {
  console.log('Starting category seeding...');
  
  const createdCategories = [];
  
  for (const category of categories) {
    const normalizedName = category.name.trim().replace(/\\s+/g, ' ');
    const nameSearch = normalizedName.toLowerCase();
    
    const created = await prisma.category.upsert({
      where: { nameSearch },
      update: {
        name: normalizedName,
        limit: category.limit,
        limitType: category.limitType || 'household',
        icon: category.icon
      },
      create: {
        name: normalizedName,
        nameSearch,
        limit: category.limit,
        limitType: category.limitType || 'household',
        icon: category.icon
      }
    });
    
    createdCategories.push(created);
    console.log(`✓ Seeded category: ${created.name} (limit: ${created.limit})`);
  }
  
  console.log(`Category seeding completed. Total categories: ${createdCategories.length}`);
  return createdCategories;
}

// Food item seeding function
async function seedFoodItems(categories: any[]) {
  console.log('Starting food item seeding...');
  
  // Create a map of category names to IDs
  const categoryMap = new Map();
  for (const category of categories) {
    categoryMap.set(category.name, category.id);
  }
  
  const createdFoodItems = [];
  
  for (const item of foodItems) {
    const normalizedName = item.name.trim().replace(/\\s+/g, ' ');
    const nameSearch = normalizedName.toLowerCase();
    const categoryId = categoryMap.get(item.categoryName);
    
    if (!categoryId) {
      console.warn(`Warning: Category '${item.categoryName}' not found for item '${item.name}'`);
      continue;
    }
    
    const created = await prisma.foodItem.upsert({
      where: { nameSearch },
      update: {
        name: normalizedName,
        limit: item.limit,
        limitType: item.limitType || 'household',
        categoryId,
        isInStock: true,
        isLimited: item.isLimited || false,
        isClearance: false,
        vegan: item.vegan || false,
        vegetarian: item.vegetarian || false,
        glutenFree: item.glutenFree || false,
        organic: item.organic || false,
        halal: item.halal || false,
        kosher: item.kosher || false,
        readyToEat: item.readyToEat || false
      },
      create: {
        name: normalizedName,
        nameSearch,
        limit: item.limit,
        limitType: item.limitType || 'household',
        categoryId,
        isInStock: true,
        isLimited: item.isLimited || false,
        isClearance: false,
        vegan: item.vegan || false,
        vegetarian: item.vegetarian || false,
        glutenFree: item.glutenFree || false,
        organic: item.organic || false,
        halal: item.halal || false,
        kosher: item.kosher || false,
        readyToEat: item.readyToEat || false
      }
    });
    
    createdFoodItems.push(created);
  }
  
  console.log(`Food item seeding completed. Total food items: ${createdFoodItems.length}`);
  
  // Summary by category
  const categoryStats = new Map();
  for (const item of createdFoodItems) {
    const categoryName = categories.find(c => c.id === item.categoryId)?.name;
    if (categoryName) {
      categoryStats.set(categoryName, (categoryStats.get(categoryName) || 0) + 1);
    }
  }
  
  console.log('Items by category:');
  for (const [categoryName, count] of categoryStats.entries()) {
    console.log(`  - ${categoryName}: ${count} items`);
  }
  
  return createdFoodItems;
}

// System prompt seeding function
async function seedSystemPrompts() {
  console.log('Starting system prompt seeding...');

  for (const prompt of systemPrompts) {
    console.log(`Seeding system prompt: ${prompt.name}`);
    
    await prisma.systemPrompt.upsert({
      where: { name: prompt.name },
      update: {
        promptType: prompt.promptType,
        isActive: prompt.isActive,
        isDefault: prompt.isDefault,
        description: prompt.description,
        serviceDescription: prompt.serviceDescription || null,
        translationApproach: prompt.translationApproach || null,
        contextGuidance: prompt.contextGuidance || null,
        additionalGuidance: prompt.additionalGuidance || null,
        skipTranslation: prompt.skipTranslation || null,
        includeEnglish: prompt.includeEnglish || null,
        skipTranslationThreshold: prompt.skipTranslationThreshold || null,
        includeEnglishThreshold: prompt.includeEnglishThreshold || null,
        rememberFormattingChoices: prompt.rememberFormattingChoices || true,
        temperature: prompt.temperature || null,
        topP: prompt.topP || null
      },
      create: {
        name: prompt.name,
        promptType: prompt.promptType,
        isActive: prompt.isActive,
        isDefault: prompt.isDefault,
        description: prompt.description,
        serviceDescription: prompt.serviceDescription || null,
        translationApproach: prompt.translationApproach || null,
        contextGuidance: prompt.contextGuidance || null,
        additionalGuidance: prompt.additionalGuidance || null,
        skipTranslation: prompt.skipTranslation || null,
        includeEnglish: prompt.includeEnglish || null,
        skipTranslationThreshold: prompt.skipTranslationThreshold || null,
        includeEnglishThreshold: prompt.includeEnglishThreshold || null,
        rememberFormattingChoices: prompt.rememberFormattingChoices || true,
        temperature: prompt.temperature || null,
        topP: prompt.topP || null
      }
    });
    
    console.log(`✓ Seeded: ${prompt.name} (${prompt.promptType})`);
  }

  console.log('System prompt seeding completed.');
  
  // Verify seeded prompts
  const seededPrompts = await prisma.systemPrompt.findMany({
    where: {
      name: { in: systemPrompts.map(p => p.name) }
    },
    select: {
      name: true,
      promptType: true,
      isActive: true
    }
  });
  
  console.log('Seeded system prompts verification:');
  seededPrompts.forEach((prompt: any) => {
    console.log(`  - ${prompt.name} (${prompt.promptType}) - Active: ${prompt.isActive}`);
  });
  
  // Count total system prompts
  const totalCount = await prisma.systemPrompt.count();
  console.log(`Total system prompts in database: ${totalCount}`);
}

// Master seeding function
async function main() {
  console.log('🌱 Starting database seeding...');
  console.log('=====================================');

  try {
    // Seed global limit first
    await seedGlobalLimit();
    console.log('');
    
    // Seed languages
    await seedLanguages();
    console.log('');
    
    // Seed system prompts
    await seedSystemPrompts();
    console.log('');
    
    // Seed categories
    const categories = await seedCategories();
    console.log('');
    
    // Seed food items (depends on categories)
    await seedFoodItems(categories);
    console.log('');
    
    console.log('=====================================');
    console.log('✅ Database seeding completed successfully!');
    
    // Final summary
    const finalCounts = await Promise.all([
      prisma.language.count(),
      prisma.systemPrompt.count(),
      prisma.category.count(),
      prisma.foodItem.count(),
      prisma.globalLimit.count()
    ]);
    
    console.log('Final database summary:');
    console.log(`  - Languages: ${finalCounts[0]}`);
    console.log(`  - System Prompts: ${finalCounts[1]}`);
    console.log(`  - Categories: ${finalCounts[2]}`);
    console.log(`  - Food Items: ${finalCounts[3]}`);
    console.log(`  - Global Limits: ${finalCounts[4]}`);
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
