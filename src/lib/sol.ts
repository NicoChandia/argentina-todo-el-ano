// Sol de Mayo simplificado (como el de la bandera): 32 rayos que alternan rectos y ondulados,
// alrededor de un disco. Devuelve el trazado para un SVG con viewBox="-100 -100 200 200".
export const DISCO_SOL = 34;

export const rayosSol = (() => {
  const R = 100;
  const disco = DISCO_SOL;
  const out: string[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rot = (x: number, y: number) =>
      `${(x * Math.cos(a) - y * Math.sin(a)).toFixed(2)},${(x * Math.sin(a) + y * Math.cos(a)).toFixed(2)}`;
    if (i % 2 === 0) {
      const w = 6.5;
      out.push(`M${rot(disco, -w)}L${rot(R, 0)}L${rot(disco, w)}Z`);
    } else {
      const largo = 86, w = 4.5, pts: string[] = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        pts.push(rot(disco + (largo - disco) * u, -w * (1 - u) + Math.sin(u * Math.PI * 3) * w * 0.9));
      }
      for (let k = 12; k >= 0; k--) {
        const u = k / 12;
        pts.push(rot(disco + (largo - disco) * u, w * (1 - u) + Math.sin(u * Math.PI * 3) * w * 0.9));
      }
      out.push(`M${pts.join('L')}Z`);
    }
  }
  return out.join('');
})();
