export const t = {
  brand: 'Ember',
  product: 'Gurugram Fire Hazard',
  simulated: 'Simulated data · Prototype',
  live: 'Live',
  nextUpdate: 'Next update',
  prototypeIndex: 'Prototype index — not an official rating',
  bands: ['Low', 'Moderate', 'High', 'Very High', 'Extreme'],
  bandAdvice: [
    'Normal vigilance. Routine checks.',
    'Avoid open burning. Keep extinguishers accessible.',
    'No open flames outdoors. Clear garbage and dry scrub near buildings.',
    'Fire crews on heightened readiness. Industrial hot-work should pause.',
    'Extreme ignition risk. Report any smoke immediately — dial 101.',
  ],
  types: {
    building: 'Building', industrial: 'Industrial', vehicle: 'Vehicle',
    garbage: 'Garbage', scrub: 'Scrub / Forest', electrical: 'Electrical',
  },
  status: { reported: 'Reported', responding: 'Responding', contained: 'Contained', closed: 'Closed' },
  landUse: {
    industrial: 'Industrial', landfill: 'Landfill', forest: 'Forest / Aravalli', market: 'Dense market',
    residential: 'Residential', commercial: 'Commercial', rural: 'Rural',
  },
} as const;
