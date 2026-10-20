"""Default category taxonomy. Admins can add, rename or deactivate categories afterwards."""

DEFAULT_CATEGORIES = [
    {
        'name': 'Fruits',
        'slug': 'fruits',
        'description': 'Seasonal and tropical fruit picked at the farm.',
        'children': [('Tropical Fruits', 'tropical-fruits'), ('Citrus', 'citrus'), ('Exotic Fruits', 'exotic-fruits'), ('Berries', 'berries')],
    },
    {
        'name': 'Vegetables',
        'slug': 'vegetables',
        'description': 'Everyday and heirloom vegetables from small growers.',
        'children': [('Leafy Greens', 'leafy-greens'), ('Root Vegetables', 'root-vegetables'), ('Gourds & Squashes', 'gourds-squashes'), ('Everyday Vegetables', 'everyday-vegetables')],
    },
    {
        'name': 'Plantation Crops',
        'slug': 'plantation-crops',
        'description': 'Coffee, tea, spices and cocoa from plantation estates.',
        'children': [('Coffee', 'coffee'), ('Tea', 'tea'), ('Spices', 'spices'), ('Cocoa', 'cocoa')],
    },
    {
        'name': 'Honey & Bee Products',
        'slug': 'honey-bee-products',
        'description': 'Raw honey and hive products from beekeepers.',
        'children': [('Honey', 'honey'), ('Beeswax & Propolis', 'beeswax-propolis'), ('Bee Pollen', 'bee-pollen')],
    },
    {
        'name': 'Livestock Products',
        'slug': 'livestock-products',
        'description': 'Eggs, dairy and meat from pasture-raised animals.',
        'children': [('Eggs', 'eggs'), ('Dairy', 'dairy'), ('Meat & Poultry', 'meat-poultry')],
    },
]


def install_default_categories(category_model):
    """Idempotent: creates missing default categories, never changes existing ones."""
    for position, entry in enumerate(DEFAULT_CATEGORIES):
        parent, _ = category_model.objects.get_or_create(
            slug=entry['slug'], defaults={'name': entry['name'], 'description': entry['description'], 'position': position}
        )
        for child_position, (name, slug) in enumerate(entry['children']):
            category_model.objects.get_or_create(slug=slug, defaults={'name': name, 'parent': parent, 'position': child_position})
