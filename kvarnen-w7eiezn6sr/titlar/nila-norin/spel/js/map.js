import {
  TAU, clamp, lerp, dist,
  drawBgPlate, getPlayRect, drawHero, drawGlowRing, drawGuideHand, drawShadow,
  playSfx, save, blit, drawIkon,
} from './core.js';

export class MapScene {
  constructor(levels, onEnterLevel, particles) {
    this.levels = levels;
    this.onEnterLevel = onEnterLevel;
    this.particles = particles;
    this.idleT = 0;
    this.activeIdx = 0;
    this.heroX = 0;
    this.heroY = 0;
    this.buddyX = 0;
    this.buddyY = 0;
    this.heroJump = 0;
    this.buddyJump = 0;
    this.nodes = [];
    this.shakeIdx = -1;
    this.shakeT = 0;
    this.inited = false;
  }

  enter() {
    this.idleT = 0;
    this.activeIdx = Math.min(save.unlocked, Math.max(0, this.levels.length - 1));
    this.inited = false;
  }

  _layout(W, H) {
    const pr = getPlayRect(W, H);
    const land = W >= H;
    const cols = land ? 5 : 2;
    const rows = Math.ceil(this.levels.length / cols);
    const padX = land ? 56 : 58;
    const padY = land ? 42 : 46;
    const cellW = cols > 1 ? (pr.w - padX * 2) / (cols - 1) : 0;
    const cellH = rows > 1 ? (pr.h - padY * 2) / (rows - 1) : 0;

    this.nodes = this.levels.map((lv, i) => {
      const r = Math.floor(i / cols);
      let c = i % cols;
      if (r % 2 === 1) c = cols - 1 - c; // slingrande S-stig
      const x = pr.x + padX + c * cellW;
      const y = pr.y + padY + r * cellH + (land ? Math.sin(i * 1.1) * 10 : 0);
      return { x, y, r: land ? 31 : 28, lv, i };
    });

    const cur = this.nodes[this.activeIdx] || this.nodes[0];
    if (!this.inited && cur) {
      this.heroX = cur.x - 42;
      this.heroY = cur.y + 42;
      this.buddyX = cur.x + 42;
      this.buddyY = cur.y + 44;
      this.inited = true;
    }
    return pr;
  }

  update(dt, W, H) {
    this._layout(W, H);
    this.idleT += dt;
    if (this.heroJump > 0) this.heroJump = Math.max(0, this.heroJump - dt * 2.4);
    if (this.buddyJump > 0) this.buddyJump = Math.max(0, this.buddyJump - dt * 2.4);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);

    const target = this.nodes[this.activeIdx] || this.nodes[0];
    if (target) {
      const side = target.x > W * 0.72 ? -54 : 50;
      this.heroX = lerp(this.heroX, clamp(target.x - 44, 48, W - 48), Math.min(1, dt * 6));
      this.heroY = lerp(this.heroY, clamp(target.y + 40, 110, H - 56), Math.min(1, dt * 6));
      this.buddyX = lerp(this.buddyX, clamp(target.x + side, 48, W - 48), Math.min(1, dt * 5));
      this.buddyY = lerp(this.buddyY, clamp(target.y + 42, 110, H - 56), Math.min(1, dt * 5));
    }
  }

  onDown(x, y) {
    this.idleT = 0;
    // Tryck på systrarna → glädjehopp + ljud
    if (dist(x, y, this.heroX, this.heroY - 40) < 52) {
      this.heroJump = 1;
      playSfx('cheer');
      this.particles.burst(this.heroX, this.heroY - 52, 14, { kind: 'heart', colors: ['#ff93b0', '#ffe078'] });
      return;
    }
    if (dist(x, y, this.buddyX, this.buddyY - 40) < 52) {
      this.buddyJump = 1;
      playSfx('pling');
      this.particles.burst(this.buddyX, this.buddyY - 52, 14, { kind: 'star' });
      return;
    }

    // Tryck på bannod
    for (const n of this.nodes) {
      if (dist(x, y, n.x, n.y) <= n.r + 18) {
        const isUnlocked = save.unlockAll || n.i <= save.unlocked;
        if (isUnlocked) {
          this.activeIdx = n.i;
          this.heroJump = 0.8;
          playSfx('ok');
          this.particles.burst(n.x, n.y, 16, { kind: 'star' });
          this.onEnterLevel(n.lv.id);
        } else {
          this.shakeIdx = n.i;
          this.shakeT = 0.45;
          playSfx('softno');
          const next = this.nodes[Math.min(save.unlocked, this.nodes.length - 1)];
          if (next) this.particles.burst(next.x, next.y, 10, { kind: 'star' });
        }
        return;
      }
    }

    // Lek i dalen: tryck var som helst ger stjärngnistor
    playSfx('tap');
    this.particles.burst(x, y, 8, { kind: 'dot', speed: 70 });
  }

  onMove() {}
  onUp() {}

  draw(ctx, T, W, H) {
    drawBgPlate(ctx, W, H, 'karta', '#dfd3b5');
    this._layout(W, H);

    // Mjuk ljus akvarellslöja så noder och systrar läses klockrent
    ctx.save();
    ctx.fillStyle = 'rgba(248, 240, 220, 0.24)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Stig mellan banor
    if (this.nodes.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.82)';
      ctx.lineWidth = 10;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      this.nodes.forEach((n, idx) => {
        if (idx === 0) ctx.moveTo(n.x, n.y);
        else {
          const prev = this.nodes[idx - 1];
          const mx = (prev.x + n.x) / 2;
          const my = (prev.y + n.y) / 2 - 12;
          ctx.quadraticCurveTo(mx, my, n.x, n.y);
        }
      });
      ctx.stroke();
      ctx.restore();
    }

    // Hitta nästa rekommenderade bana för mild pekguide
    let focusIdx = this.nodes.findIndex((n) => (save.unlockAll || n.i <= save.unlocked) && !(save.stars[n.lv.id] > 0));
    if (focusIdx < 0) focusIdx = 0;

    // Rita varje bannod
    for (const n of this.nodes) {
      const unlocked = save.unlockAll || n.i <= save.unlocked;
      const st = save.stars[n.lv.id] || 0;
      const shaking = this.shakeIdx === n.i && this.shakeT > 0;
      const sx = shaking ? Math.sin(this.shakeT * 38) * 6 : 0;
      const nx = n.x + sx, ny = n.y;

      if (n.i === focusIdx && unlocked) {
        drawGlowRing(ctx, T, nx, ny, n.r + 8, 'rgba(255, 210, 82, 0.85)');
      }

      drawShadow(ctx, nx, ny + n.r + 3, n.r * 0.8, 7, 0.2);

      ctx.save();
      ctx.beginPath();
      ctx.arc(nx, ny, n.r, 0, TAU);
      ctx.fillStyle = st > 0 ? '#fff6d6' : (unlocked ? '#fdf7e7' : 'rgba(232, 224, 206, 0.78)');
      ctx.fill();
      ctx.lineWidth = st > 0 ? 3.5 : (unlocked ? 3 : 2);
      ctx.strokeStyle = st > 0 ? '#e3a128' : (unlocked ? '#8e6b3d' : '#a49a88');
      ctx.stroke();

      // Ikon
      ctx.globalAlpha = unlocked ? 1 : 0.45;
      drawIkon(ctx, unlocked ? n.lv.art : 'hanglas', nx, ny + 1, n.r * 1.25, { noTrack: true });
      ctx.restore();

      // Titel-etikett + stjärnor under noden
      ctx.save();
      ctx.font = '800 11px "Trebuchet MS", system-ui, sans-serif';
      const label = `${n.i + 1}. ${n.lv.shortTitle}`;
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(253, 247, 234, 0.92)';
      ctx.strokeStyle = 'rgba(138, 108, 66, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(nx - tw / 2, ny + n.r + 2, tw, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = unlocked ? '#332417' : '#7b6e5c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, nx, ny + n.r + 11.5);

      // 3 små stjärnprickar ovanpå noden
      for (let k = 0; k < 3; k++) {
        const sx2 = nx + (k - 1) * 12;
        const sy2 = ny - n.r - 5 + Math.abs(k - 1) * 2;
        // Målad stjärna (atlas) — släckt och genomskinlig för ej tagna stjärnor
        blit(ctx, 'star', sx2, sy2 + 7, { h: 14, alpha: k < st ? 1 : 0.28, noTrack: true });
      }
      ctx.restore();
    }

    // Rita båda systrarna tillsammans i dalen!
    const leadId = save.sister;
    const buddyId = leadId === 'nila' ? 'norin' : 'nila';
    const scale = Math.min(W, H) < 460 ? 0.85 : 0.98;
    const hBob = this.heroJump > 0 ? -Math.sin(this.heroJump * Math.PI) * 30 : 0;
    const bBob = this.buddyJump > 0 ? -Math.sin(this.buddyJump * Math.PI) * 28 : 0;
    drawHero(ctx, T, this.buddyX, this.buddyY, {
      who: buddyId,
      scale: scale * 0.92,
      expr: this.buddyJump > 0 ? 'skratt' : 'glad',
      pose: this.buddyJump > 0 ? 'jump' : 'idle',
      bob: bBob,
      face: -1,
    });
    drawHero(ctx, T, this.heroX, this.heroY, {
      who: leadId,
      scale,
      expr: this.heroJump > 0 ? 'skratt' : (this.idleT > 2.2 ? 'busig' : 'glad'),
      pose: this.heroJump > 0 ? 'jump' : 'cheer',
      bob: hBob,
      face: 1,
    });

    // Visa pekhand på nästa bana om spelaren tvekar
    const focus = this.nodes[focusIdx];
    if (focus && this.idleT > 1.8) {
      drawGuideHand(ctx, T, focus.x + 12, focus.y + 8);
    }
  }
}
