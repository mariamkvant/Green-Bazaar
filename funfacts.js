// Fun facts and recommended products for plant categories
const plantFunFacts = {
  'thuja': [
    "Ancient Egyptians used Thuja resin in their mummification process — it was considered sacred.",
    "The name 'Thuja' comes from the Greek word 'thyia' meaning 'to sacrifice' — the wood was burned as incense in temples.",
    "Thuja Smaragd can live for over 200 years and was named 'Smaragd' after the Danish word for emerald."
  ],
  'hedge': [
    "The world's tallest hedge is the Meikleour Beech Hedge in Scotland — planted in 1745, it stands 30 meters tall.",
    "In the movie 'The Shining', the iconic hedge maze was actually made of 900 real hedge plants on a studio lot.",
    "Cherry Laurel was a favorite of Victorian-era gardeners and features in many Agatha Christie novels as a garden backdrop."
  ],
  'ornamental': [
    "Japanese Maples have been cultivated for over 400 years — some specimens in Japanese temples are worth over $10,000.",
    "Magnolias are among the oldest flowering plants on Earth — fossils date back 95 million years, before bees existed.",
    "Lavender was used by Cleopatra to seduce both Julius Caesar and Mark Antony — she reportedly scented her ship's sails with it."
  ],
  'fruit': [
    "Georgia is considered the birthplace of wine — archaeologists found 8,000-year-old grape seeds in Georgian clay vessels (qvevri).",
    "The pomegranate appears in Greek mythology as the fruit that bound Persephone to the underworld for half the year.",
    "Fig trees are mentioned more than any other plant in the Bible — Adam and Eve used fig leaves, and Buddha achieved enlightenment under a fig tree."
  ],
  'seeds': [
    "The oldest viable seed ever germinated was a 2,000-year-old Judean date palm seed found at Masada, Israel.",
    "A single sunflower head can contain up to 2,000 seeds arranged in perfect Fibonacci spirals.",
    "Orchid seeds are the smallest in the plant kingdom — a single pod can contain up to 3 million seeds."
  ],
  'fertilizer': [
    "Ancient Romans used pigeon droppings as premium fertilizer — it was so valuable it was taxed.",
    "The Haber-Bosch process for making synthetic fertilizer is credited with enabling the world to feed 4 billion additional people.",
    "Seaweed has been used as fertilizer for over 1,000 years by coastal farmers in Ireland and Scotland."
  ],
  'materials': [
    "Terracotta pots have been used for growing plants since 3,000 BC in ancient Mesopotamia.",
    "The word 'garden' comes from the Old English 'geard' meaning 'enclosure' — originally just a fenced area.",
    "Japanese Wabi-sabi garden design philosophy values imperfection — cracked pots are considered more beautiful than perfect ones."
  ]
};

const recommendedProducts = {
  'thuja': [
    { name: "Acidic Soil Mix", desc: "pH 5.5-6.5, ideal for Thuja", type: "soil" },
    { name: "Slow-Release Evergreen Fertilizer", desc: "NPK 12-6-6, feeds for 3 months", type: "fertilizer" },
    { name: "Root Growth Stimulator", desc: "Helps transplanted Thuja establish faster", type: "fertilizer" }
  ],
  'hedge': [
    { name: "Hedge Trimming Shears", desc: "Professional quality for clean cuts", type: "tools" },
    { name: "Organic Mulch", desc: "Retains moisture, suppresses weeds", type: "materials" },
    { name: "Balanced Fertilizer NPK 10-10-10", desc: "All-purpose for hedge plants", type: "fertilizer" }
  ],
  'ornamental': [
    { name: "Decorative Ceramic Pot", desc: "Handmade, drainage hole included", type: "pots" },
    { name: "Liquid Plant Food", desc: "Weekly feeding for ornamentals", type: "fertilizer" },
    { name: "Ericaceous Compost", desc: "For acid-loving plants like Maples", type: "soil" }
  ],
  'fruit': [
    { name: "Fruit Tree Fertilizer", desc: "High potassium for fruit production", type: "fertilizer" },
    { name: "Pruning Secateurs", desc: "Sharp bypass blades for clean cuts", type: "tools" },
    { name: "Tree Support Stakes", desc: "Bamboo stakes with ties", type: "materials" }
  ],
  'seeds': [
    { name: "Seed Starting Tray", desc: "72-cell with humidity dome", type: "materials" },
    { name: "Seed Compost", desc: "Fine, sterile mix for germination", type: "soil" },
    { name: "Heat Mat", desc: "Speeds up germination", type: "materials" }
  ],
  'fertilizer': [],
  'materials': []
};

function getFunFacts(category) { return plantFunFacts[category] || plantFunFacts['ornamental']; }
function getRecommendedProducts(category) { return recommendedProducts[category] || []; }
