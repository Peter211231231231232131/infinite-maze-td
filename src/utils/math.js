// Seeded random number generator
export const mulberry32 = (a) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export const getSeed = (x, y, baseSeed = 12345) => {
  // Combine x, y, and baseSeed into a single integer seed
  // Cantor pairing function or similar
  const shiftedX = x + 1000000; // Offset to avoid negative issues
  const shiftedY = y + 1000000;
  return (shiftedX * 73856093 ^ shiftedY * 19349663) ^ baseSeed;
}

export const random = (x, y, baseSeed) => {
  const seed = getSeed(x, y, baseSeed);
  return mulberry32(seed)();
}
