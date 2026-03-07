// filepath: types.d.ts
declare module '@mapbox/point-geometry' {
  // Stub the exports if known; otherwise, use 'any' as a fallback
  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
    // Add other methods/properties as needed based on the package docs
  }
  // Add other exports here
}