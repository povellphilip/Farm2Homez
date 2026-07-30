MASTER_PRODUCT_MAPPING = {
    'Fresh Farm Produce': {
        'Fruits': [
            'Avocado',
            'Rambutan',
            'Mangosteen',
            'Salak',
            'Dragon Fruit',
            'Banana',
            'Pineapple',
            'Papaya',
            'Mango',
            'Jackfruit',
            'Passion Fruit',
            'Orange',
            'Lemon',
        ],
        'Vegetables': [
            'Tomato',
            'Onion',
            'Potato',
            'Cabbage',
            'Cauliflower',
            'Beans',
            'Carrot',
            'Beetroot',
            'Cucumber',
            'Chilli',
            'Brinjal',
            'Okra',
        ],
    },
    'Plantation Crops': {
        'Coffee': ['Coffee Beans', 'Coffee Powder', 'Green Coffee'],
        'Spices': ['Black Pepper', 'White Pepper', 'Cardamom', 'Clove', 'Nutmeg', 'Cinnamon', 'Cocoa', 'Tea'],
    },
    'Honey & Bee Products': {
        'Honey': ['Wild Honey', 'Stingless Bee Honey', 'Cerana Honey', 'Honeycomb'],
        'Bee Products': ['Beeswax', 'Propolis', 'Bee Pollen', 'Queen Bees', 'Bee Colonies'],
    },
    'Livestock Products': {
        'Meat': ['Country Chicken', 'Broiler Chicken', 'Duck', 'Goat Meat', 'Mutton', 'Pork', 'Beef', 'Rabbit Meat', 'Quail'],
        'Eggs': ['Country Eggs', 'Farm Eggs', 'Duck Eggs', 'Quail Eggs', 'Turkey Eggs'],
    },
    'Fish & Aquaculture': {
        'Fish': ['Tilapia', 'Catla', 'Rohu', 'Grass Carp', 'Pearl Spot', 'Freshwater Prawns', 'Ornamental Fish', 'Fish Fingerlings'],
    },
    'Dairy Products': {
        'Dairy': ['Fresh Milk', 'Curd', 'Ghee', 'Butter', 'Paneer', 'Cheese'],
    },
    'Seeds & Planting Materials': {
        'Planting Materials': [
            'Coffee Seedlings',
            'Avocado Grafts',
            'Rambutan Grafts',
            'Mangosteen Plants',
            'Coconut Seedlings',
            'Pepper Cuttings',
            'Cardamom Seedlings',
            'Fruit Tree Grafts',
            'Vegetable Seeds',
        ],
    },
    'Fertilizers': {
        'Organic': ['Vermicompost', 'Cow Manure', 'Poultry Manure', 'Neem Cake', 'Bone Meal', 'Fish Amino Acid', 'Panchagavya'],
        'Inorganic': ['Urea', 'DAP', 'MOP', 'SSP', 'NPK Mixtures', 'Water Soluble Fertilizers', 'Micronutrient Mixtures', 'Nano Fertilizers'],
    },
    'Crop Protection Products': {
        'Crop Protection': ['Fungicides', 'Insecticides', 'Herbicides', 'Miticides', 'Plant Growth Regulators', 'Sticky Traps', 'Pheromone Traps', 'Bio-Pesticides'],
    },
    'Farm Machinery': {
        'Small Equipment': ['Battery Sprayers', 'Battery Sprayer', 'Power Sprayers', 'Brush Cutters', 'Chainsaws', 'Hedge Cutters', 'Earth Augers'],
        'Large Equipment': ['Tractors', 'Power Tillers', 'Rotavators', 'Cultivators', 'Harvesters', 'Mini Excavators'],
    },
    'Irrigation Products': {
        'Irrigation': ['Drip Irrigation Systems', 'Sprinklers', 'HDPE Pipes', 'PVC Pipes', 'Water Tanks', 'Filters', 'Fertigation Units', 'Solar Pumps'],
    },
    'Animal Husbandry Supplies': {
        'Feed & Equipment': ['Poultry Feed', 'Cattle Feed', 'Fish Feed', 'Mineral Mixtures', 'Feed Supplements', 'Poultry Equipment', 'Dairy Equipment'],
    },
    'Value Added Products': {
        'Processed Foods': ['Roasted Coffee', 'Spice Powders', 'Pickles', 'Jams', 'Squashes', 'Dried Fruits', 'Jackfruit Flour', 'Avocado Oil', 'Virgin Coconut Oil'],
    },
    'Farm Tourism Products': {
        'Gift Packs': ['Fruit Baskets', 'Farm Gift Hampers', 'Honey Gift Packs', 'Spice Gift Boxes', 'Coffee Gift Packs'],
    },
}


def normalize(value):
    return value.strip().lower().replace('-', ' ')


PRODUCT_LOOKUP = {
    normalize(product): {'category': category, 'subcategory': subcategory}
    for category, subcategories in MASTER_PRODUCT_MAPPING.items()
    for subcategory, products in subcategories.items()
    for product in products
}


def classify_product(product_name):
    normalized_name = normalize(product_name)
    if normalized_name in PRODUCT_LOOKUP:
        result = PRODUCT_LOOKUP[normalized_name]
        return result['category'], result['subcategory'], False

    for product_key, result in PRODUCT_LOOKUP.items():
        if product_key in normalized_name or normalized_name in product_key:
            return result['category'], result['subcategory'], False

    return 'Other', 'Other', True
