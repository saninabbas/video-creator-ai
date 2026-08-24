export interface VisualCollection {
  [category: string]: string[];
}

export const VISUAL_COLLECTIONS: Record<string, string[]> = {
  sports_running: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1080&h=1920&fit=crop&q=85', // Track runner sprinting
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1080&h=1920&fit=crop&q=85', // Male runner morning light
    'https://images.unsplash.com/photo-1486218119243-13883505764c?w=1080&h=1920&fit=crop&q=85', // Athletic runner road
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1080&h=1920&fit=crop&q=85', // Swimming athlete
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1080&h=1920&fit=crop&q=85', // Gym fitness workout
  ],
  healthcare_medical: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1080&h=1920&fit=crop&q=85', // Doctor with stethoscope
    'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1080&h=1920&fit=crop&q=85', // Medical care hospital
    'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1080&h=1920&fit=crop&q=85', // Hospital modern doctor consultation
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1080&h=1920&fit=crop&q=85', // Healthy medical care clinic
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080&h=1920&fit=crop&q=85', // Healthy nutrition & diet
  ],
  ai_technology: [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop&q=85', // AI Neural network abstract
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&h=1920&fit=crop&q=85', // AI Face cybernetic
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&h=1920&fit=crop&q=85', // Digital globe network
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&h=1920&fit=crop&q=85', // Matrix cyber code
  ],
  nature_ocean: [
    'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=1080&h=1920&fit=crop&q=85', // Deep blue ocean coral
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&h=1920&fit=crop&q=85', // Dramatic mountain peaks
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&h=1920&fit=crop&q=85', // Foggy forest sunrise
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1920&fit=crop&q=85', // Tropical pristine beach
  ],
  business_finance: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1080&h=1920&fit=crop&q=85', // Modern skyscraper financial district
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1080&h=1920&fit=crop&q=85', // Stock market graphs
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1080&h=1920&fit=crop&q=85', // Creative team collaboration
  ],
  cinematic_general: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop&q=85', // Cinematic technology chip
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&h=1920&fit=crop&q=85', // Cinematic sunset valley
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080&h=1920&fit=crop&q=85', // Photorealistic adventure
  ]
};

export function getVisualForPrompt(prompt: string, sceneNumber: number = 1): string {
  const p = prompt.toLowerCase();

  let category = 'cinematic_general';
  if (p.includes('sport') || p.includes('run') || p.includes('jog') || p.includes('fitness') || p.includes('gym') || p.includes('athlet') || p.includes('train')) {
    category = 'sports_running';
  } else if (p.includes('health') || p.includes('doctor') || p.includes('medic') || p.includes('hospital') || p.includes('care') || p.includes('food') || p.includes('diet')) {
    category = 'healthcare_medical';
  } else if (p.includes('ai') || p.includes('tech') || p.includes('robot') || p.includes('cyber') || p.includes('code') || p.includes('future') || p.includes('comput')) {
    category = 'ai_technology';
  } else if (p.includes('ocean') || p.includes('sea') || p.includes('water') || p.includes('nature') || p.includes('mountain') || p.includes('space') || p.includes('earth')) {
    category = 'nature_ocean';
  } else if (p.includes('money') || p.includes('business') || p.includes('finance') || p.includes('rich') || p.includes('crypto') || p.includes('stock')) {
    category = 'business_finance';
  }

  const list = VISUAL_COLLECTIONS[category] || VISUAL_COLLECTIONS.cinematic_general;
  const index = (sceneNumber - 1) % list.length;
  return list[index];
}
