import {
  TAU, clamp, lerp, dist,
  blit, drawHero, drawShadow, drawGlowRing, drawGuideHand,
  drawMushroom, drawHeartPath, playSfx, playNote,
  createHeroStage, updateHeroStage, drawHeroStage, reactHeroStage,
} from '../core.js';

export const level01 = {
  id: 'rescue',
  shortTitle: 'Djur',
  title: 'Djurräddningen',
  art: 'uggla',
  bg: 'skog',
  tint: '#c9d7b8',
  goalTotal: 4,
  rounds: 4,
  goalArt: 'tass',
  bookDesc: 'Skogens fyra djurfamiljer myser tillsammans!',

  create(api) {
    const s = {
      idleT: 0,
      firstDone: false,
      dragging: null,
      carried: null,
      dragOffX: 0,
      dragOffY: 0,
      downX: 0,
      downY: 0,
      heroX: 0,
      heroY: 0,
      heroFace: 1,
      heroExpr: 'glad',
      heroExprT: 0,
      heroJump: 0,
      buddyJump: 0,
      buddyExpr: 'glad',
      buddyExprT: 0,
      fishPop: 0,
      butterPop: 0, trail: [],
      inited: false,
      animals: [
        { id: 'owl', hid: (api.round || 1) > 1, hideKind: (api.round || 1) > 1 ? 'bush' : 'open', reunited: false, popT: 1, hugT: 0, callT: 0, peekT: 0, x: 0, y: 0, mx: 0, my: 0, hx: 0, hy: 0 },
        { id: 'bunny', hid: true, peekT: 0, hideKind: 'bush', reunited: false, popT: 0, hugT: 0, shakeT: 0, callT: 0, x: 0, y: 0, mx: 0, my: 0, hx: 0, hy: 0 },
        { id: 'fox', hid: true, peekT: 0, hideKind: 'flower', reunited: false, popT: 0, hugT: 0, shakeT: 0, callT: 0, x: 0, y: 0, mx: 0, my: 0, hx: 0, hy: 0 },
        { id: 'hedge', hid: true, peekT: 0, hideKind: 'log', reunited: false, popT: 0, hugT: 0, shakeT: 0, callT: 0, x: 0, y: 0, mx: 0, my: 0, hx: 0, hy: 0 },
      ],
      stage: createHeroStage(),
      shrooms: [
        { rx: 0.16, ry: 0.85, color: '#e66c5a', squash: 0, note: 0 },
        { rx: 0.38, ry: 0.89, color: '#f0b84c', squash: 0, note: 2 },
        { rx: 0.77, ry: 0.44, color: '#d778a8', squash: 0, note: 4 },
      ],
      motes: [
        { rx: 0.34, ry: 0.24, t: 0, cd: 0 },
        { rx: 0.64, ry: 0.22, t: 2, cd: 0 },
      ],
      creek: { x: 0, y: 0 },
      flowers: { x: 0, y: 0 },
    };

    function layout(W, H) {
      const pr = api.playRect(W, H);
      const land = W >= H;
      const P = (rx, ry) => [pr.x + pr.w * rx, pr.y + pr.h * ry];

      const coords = land ? {
        owlM: P(0.30, 0.31), owlH: P(0.42, 0.60),
        bunnyM: P(0.84, 0.24), bunnyH: P(0.67, 0.63),
        foxM: P(0.13, 0.52), foxH: P(0.49, 0.36),
        hedgeM: P(0.86, 0.79), hedgeH: P(0.28, 0.80),
        creek: P(0.10, 0.78), flowers: P(0.72, 0.86),
        buddy: P(0.92, 0.50), hero0: P(0.54, 0.76),
      } : {
        owlM: P(0.22, 0.22), owlH: P(0.50, 0.48),
        bunnyM: P(0.78, 0.20), bunnyH: P(0.78, 0.54),
        foxM: P(0.18, 0.44), foxH: P(0.50, 0.27),
        hedgeM: P(0.79, 0.82), hedgeH: P(0.27, 0.78),
        creek: P(0.15, 0.64), flowers: P(0.54, 0.66),
        buddy: P(0.87, 0.89), hero0: P(0.14, 0.89),
      };

      // Rundor: ungarna gömmer sig på nya ställen varje runda (gömställena roterar).
      const hs = [coords.owlH, coords.bunnyH, coords.foxH, coords.hedgeH];
      const sh = ((api.round || 1) - 1) % 4;
      const map = {
        owl: [coords.owlM, hs[(0 + sh) % 4]],
        bunny: [coords.bunnyM, hs[(1 + sh) % 4]],
        fox: [coords.foxM, hs[(2 + sh) % 4]],
        hedge: [coords.hedgeM, hs[(3 + sh) % 4]],
      };

      for (const a of s.animals) {
        const [m, h] = map[a.id];
        a.mx = m[0]; a.my = m[1];
        a.hx = h[0]; a.hy = h[1];
        if (!s.inited || (!a.reunited && s.dragging !== a && s.carried !== a)) {
          a.x = h[0]; a.y = h[1];
        }
        if (a.reunited) {
          const side = a.mx > pr.x + pr.w * 0.5 ? -36 : 36;
          a.x = a.mx + side;
          a.y = a.my + 4;
        }
      }
      s.creek.x = coords.creek[0]; s.creek.y = coords.creek[1];
      s.flowers.x = coords.flowers[0]; s.flowers.y = coords.flowers[1];
      s.buddyPos = coords.buddy;
      if (!s.inited || (s.lastW && (s.lastW !== W || s.lastH !== H))) {
        s.heroX = coords.hero0[0];
        s.heroY = coords.hero0[1];
        s.inited = true;
      }
      s.lastW = W; s.lastH = H;
      for (const m of s.shrooms) {
        const [mx, my] = P(m.rx, m.ry);
        m.x = mx; m.y = my;
      }
      for (const mt of s.motes) {
        const [tx, ty] = P(mt.rx, mt.ry);
        mt.x = tx; mt.y = ty;
      }
    }

    function reactHero(expr, jump = 0) {
      s.heroExpr = expr;
      s.heroExprT = 1.1;
      if (jump > 0) s.heroJump = Math.max(s.heroJump, jump);
      reactHeroStage(s.stage, 'lead', expr, jump);
    }

    function reunite(a) {
      if (a.reunited) return;
      a.reunited = true;
      a.hid = false;
      a.hugT = 1;
      s.firstDone = true;
      s.dragging = null;
      if (s.carried === a) s.carried = null;
      playSfx('heart');
      playSfx('pling');
      reactHero('skratt', 1);
      s.buddyExpr = 'skratt';
      s.buddyExprT = 1.2;
      s.buddyJump = 1;
      reactHeroStage(s.stage, 'both', 'skratt', 0.9);
      api.particles.burst(a.mx, a.my - 28, 18, { kind: 'heart', colors: ['#ff88aa', '#ffe17a', '#ffbad2'] });
      const done = s.animals.filter((x) => x.reunited).length;
      api.setProgress(done);
      if (done >= 4) {
        api.win(3);
      }
    }

    function groundY(W, H) {
      const pr = api.playRect(W, H);
      return pr.y + pr.h * (W >= H ? 0.89 : 0.90);
    }
    function standPoints(W, H) {
      const pr = api.playRect(W, H);
      const gy = groundY(W, H);
      return {
        lead: [s.heroX || pr.x + pr.w * 0.14, s.heroY || gy],
        buddy: [pr.x + pr.w * 0.87, gy],
        winLead: [W * 0.42, gy],
        winBuddy: [W * 0.58, gy],
        leadFace: s.heroFace,
        buddyFace: -1,
      };
    }

    return {
      _s: s,
      groundY,
      standPoints,
      update(dt, W, H) {
        layout(W, H);
        s.idleT += dt;
        if (s.heroExprT > 0) { s.heroExprT -= dt; if (s.heroExprT <= 0) s.heroExpr = 'glad'; }
        if (s.buddyExprT > 0) { s.buddyExprT -= dt; if (s.buddyExprT <= 0) s.buddyExpr = 'glad'; }
        if (s.heroJump > 0) s.heroJump = Math.max(0, s.heroJump - dt * 2.2);
        if (s.buddyJump > 0) s.buddyJump = Math.max(0, s.buddyJump - dt * 2.2);
        if (s.fishPop > 0) s.fishPop = Math.max(0, s.fishPop - dt * 1.6);
        if (s.butterPop > 0) s.butterPop = Math.max(0, s.butterPop - dt * 1.4);

        for (const sh of s.shrooms) if (sh.squash > 0) sh.squash = Math.max(0, sh.squash - dt * 4.5);
        for (const mt of s.motes) { mt.t += dt; if (mt.cd > 0) mt.cd = Math.max(0, mt.cd - dt); }
        for (const a of s.animals) {
          if (a.popT < 1 && !a.hid) a.popT = Math.min(1, a.popT + dt * 3.4);
          if (a.shakeT > 0) a.shakeT = Math.max(0, a.shakeT - dt * 3);
          if (a.hugT > 0) a.hugT = Math.max(0, a.hugT - dt * 1.2);
          if (a.callT > 0) a.callT = Math.max(0, a.callT - dt * 1.2);
          if (a.peekT > 0) a.peekT = Math.max(0, a.peekT - dt * 1.1);
        }
        const activeBaby = s.dragging || s.carried;
        if (activeBaby && s.trail.length < 24 && Math.random() < 0.35) {
          s.trail.push({ x: activeBaby.x + (Math.random() - 0.5) * 14, y: activeBaby.y - 18, t: 1 });
        }
        for (let i = s.trail.length - 1; i >= 0; i--) {
          s.trail[i].t -= dt * 1.6;
          if (s.trail[i].t <= 0) s.trail.splice(i, 1);
        }

        // Hjälte följer med buren/dragen unge eller mål
        const pr = api.playRect(W, H);
        let tx = s.heroX, ty = s.heroY;
        if (s.dragging) {
          tx = clamp(s.dragging.x + (s.dragging.x < W * 0.5 ? 64 : -64), pr.x + 36, pr.x + pr.w - 36);
          ty = clamp(s.dragging.y + 42, pr.y + 70, pr.y + pr.h - 8);
        } else if (s.carried) {
          const side = s.heroFace >= 0 ? 34 : -34;
          s.carried.x = lerp(s.carried.x, s.heroX + side, Math.min(1, dt * 14));
          s.carried.y = lerp(s.carried.y, s.heroY - 34, Math.min(1, dt * 14));
        } else if (!api.levelWon) {
          ty = groundY(W, H);
        }
        const dx = tx - s.heroX;
        if (Math.abs(dx) > 4) s.heroFace = dx >= 0 ? 1 : -1;
        s.heroX = lerp(s.heroX, tx, Math.min(1, dt * 7));
        s.heroY = lerp(s.heroY, ty, Math.min(1, dt * 7));
        const pts = standPoints(W, H);
        if (!api.levelWon) { s.stage.lead.x = s.heroX; s.stage.lead.y = s.heroY; s.stage.lead.face = s.heroFace; s.stage.lead.init = true; }
        updateHeroStage(s.stage, dt, { won: api.levelWon, pts, syncPlay: false });
      },

      onDown(x, y, W, H) {
        layout(W, H);
        s.idleT = 0;
        s.downX = x; s.downY = y;

        // 1. Frammevarande unge → dra eller bär
        for (let i = s.animals.length - 1; i >= 0; i--) {
          const a = s.animals[i];
          if (!a.hid && !a.reunited && dist(x, y, a.x, a.y - 24) < 50) {
            s.dragging = a;
            s.carried = null;
            s.dragOffX = a.x - x;
            s.dragOffY = a.y - y;
            playSfx('ok');
            reactHero('glad', 0.3);
            api.particles.burst(a.x, a.y - 22, 8, { kind: 'star' });
            return;
          }
        }

        // 2. Gömställe → avslöja unge med pop!
        for (const a of s.animals) {
          if (a.hid && dist(x, y, a.hx, a.hy - 20) < 56) {
            a.hid = false;
            a.popT = 0;
            playSfx(a.id === 'fox' ? 'star' : (a.id === 'bunny' ? 'plant' : 'pop'));
            reactHero('forvanad', 0.5);
            s.buddyExpr = 'forvanad';
            s.buddyExprT = 0.9;
            api.particles.burst(a.hx, a.hy - 20, 14, {
              kind: a.id === 'fox' ? 'star' : 'dot',
              colors: a.id === 'bunny' ? ['#96d87e', '#cde894', '#ffe17a'] : ['#ffe17a', '#ffb86b', '#d9a468'],
            });
            return;
          }
        }

        // 3. Mamma om vi bär en unge
        if (s.carried) {
          if (dist(x, y, s.carried.mx, s.carried.my - 28) < 76) {
            reunite(s.carried);
            return;
          }
          // Tryck på fel mamma → vänlig vick + ledtråd på rätt mamma
          for (const a of s.animals) {
            if (a !== s.carried && dist(x, y, a.mx, a.my - 28) < 62) {
              playSfx('softno');
              api.particles.burst(s.carried.mx, s.carried.my - 32, 8, { kind: 'star' });
              return;
            }
          }
        }

        // 4. Återförenad djurfamilj → mys & hjärtan!
        for (const a of s.animals) {
          if (a.reunited && (dist(x, y, a.mx, a.my - 26) < 64 || dist(x, y, a.x, a.y - 20) < 48)) {
            a.hugT = 1;
            playSfx('heart');
            playNote(s.animals.indexOf(a), 0.28);
            reactHero('skratt', 0.4);
            api.particles.burst(a.mx, a.my - 32, 10, { kind: 'heart', colors: ['#ff93b0', '#ffe17a'] });
            return;
          }
        }

        // 4b. Väntande mamma → ropar med musikalisk våg & visar vägen (eller lockar hem avslöjad unge!)
        for (let i = 0; i < s.animals.length; i++) {
          const a = s.animals[i];
          if (!a.reunited && dist(x, y, a.mx, a.my - 26) < 64) {
            a.callT = 1;
            a.hugT = 0.6;
            if (a.hid) { a.shakeT = 1; a.peekT = 1; }
            playNote(i + 1, 0.34);
            reactHero('glad', 0.35);
            api.particles.burst(a.mx, a.my - 32, 10, { kind: 'heart', colors: ['#ffe17a', '#ff9ec4'] });
            if (!a.hid) {
              a.x = lerp(a.x, a.mx, 0.55);
              a.y = lerp(a.y, a.my, 0.55);
              if (dist(a.x, a.y, a.mx, a.my) < 88) reunite(a);
            }
            return;
          }
        }

        // 5. Svampar (musiktrummor!)
        for (const sh of s.shrooms) {
          if (dist(x, y, sh.x, sh.y - 16) < 42) {
            sh.squash = 1;
            playNote(sh.note, 0.35);
            reactHero('busig', 0.35);
            api.particles.burst(sh.x, sh.y - 24, 10, { colors: ['#fff6b0', sh.color] });
            return;
          }
        }

        // 6. Bäcken → hoppande fisk & plask
        if (dist(x, y, s.creek.x, s.creek.y) < 54) {
          s.fishPop = 1;
          playSfx('water');
          reactHero('forvanad', 0.4);
          api.particles.burst(s.creek.x, s.creek.y - 12, 14, { colors: ['#88dcff', '#c8f2ff', '#ffffff'], lift: 80 });
          return;
        }

        // 7. Blomsterdunge → fjärilsdans
        if (dist(x, y, s.flowers.x, s.flowers.y) < 52) {
          s.butterPop = 1;
          playSfx('pling');
          api.particles.burst(s.flowers.x, s.flowers.y - 18, 12, { colors: ['#ff9ec4', '#ffe17a', '#b6e68a'] });
          return;
        }

        // 8. Eldflugor
        for (const mt of s.motes) {
          const fx = mt.x + Math.sin(mt.t * 2) * 16;
          const fy = mt.y + Math.cos(mt.t * 2.5) * 10;
          if (mt.cd <= 0 && dist(x, y, fx, fy) < 44) {
            mt.cd = 2.6;
            playSfx('star');
            api.particles.burst(fx, fy, 12, { kind: 'star' });
            return;
          }
        }

        // 9. Systrarna själva!
        if (dist(x, y, s.heroX, s.heroY - 46) < 56) {
          reactHero('skratt', 1);
          playSfx('cheer');
          api.particles.burst(s.heroX, s.heroY - 62, 12, { kind: 'heart', colors: ['#ff93b0', '#ffe17a'] });
          return;
        }
        if (s.buddyPos && dist(x, y, s.buddyPos[0], s.buddyPos[1] - 46) < 56) {
          s.buddyExpr = 'skratt';
          s.buddyExprT = 1.1;
          s.buddyJump = 1;
          playSfx('pling');
          api.particles.burst(s.buddyPos[0], s.buddyPos[1] - 60, 12, { kind: 'star' });
          return;
        }

        // 10. Tryck på stigen → syster springer dit glatt
        const pr = api.playRect(W, H);
        if (y > pr.y + pr.h * 0.35) {
          s.heroFace = x >= s.heroX ? 1 : -1;
          s.heroX = lerp(s.heroX, clamp(x, pr.x + 36, pr.x + pr.w - 36), 0.75);
          s.heroY = lerp(s.heroY, clamp(y + 18, pr.y + pr.h * 0.55, pr.y + pr.h - 6), 0.75);
          playSfx('step');
          api.particles.burst(x, y, 5, { speed: 50, colors: ['#e7f2b4', '#ffe17a'] });
        }
      },

      onMove(x, y) {
        if (!s.dragging) return;
        s.dragging.x = x + s.dragOffX;
        s.dragging.y = y + s.dragOffY;
      },

      onUp(x, y) {
        if (!s.dragging) return;
        const a = s.dragging;
        s.dragging = null;
        // Magnetisk träff på rätt mamma
        if (dist(a.x, a.y - 20, a.mx, a.my - 26) < 88) {
          reunite(a);
          return;
        }
        // Tryckte man bara snabbt utan att dra → hoppa upp i systerns famn!
        if (dist(x, y, s.downX, s.downY) < 20) {
          s.carried = a;
          playSfx('jump');
          return;
        }
        // Råkade släppa vid fel mamma → vänlig studs tillbaka till öppningen
        for (const other of s.animals) {
          if (other !== a && dist(a.x, a.y - 20, other.mx, other.my - 26) < 76) {
            playSfx('softno');
            a.x = a.hx; a.y = a.hy;
            return;
          }
        }
        // Släppt mitt i gläntan → stannar kvar där eller bärs lätt vidare
        a.x = clamp(a.x, 40, api.W - 40);
        a.y = clamp(a.y, 100, api.H - 60);
      },

      draw(ctx, T, W, H) {
        layout(W, H);
        const activeBaby = s.dragging || s.carried;

        // Bäck-plask & hoppande guldfisk
        ctx.save();
        const cr = s.creek;
        ctx.strokeStyle = 'rgba(190, 240, 255, 0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) {
          const rw = 26 + ((T * 18 + i * 16) % 24);
          ctx.globalAlpha = 0.45 * (1 - ((T * 0.7 + i * 0.5) % 1));
          ctx.beginPath();
          ctx.ellipse(cr.x, cr.y, rw, rw * 0.4, 0, 0, TAU);
          ctx.stroke();
        }
        if (s.fishPop > 0) {
          ctx.globalAlpha = 1;
          const arc = Math.sin(s.fishPop * Math.PI);
          const fy = cr.y - 10 - arc * 48;
          ctx.fillStyle = '#f8a545';
          ctx.beginPath();
          ctx.ellipse(cr.x, fy, 12, 7, -0.35 + (1 - s.fishPop) * 0.8, 0, TAU);
          ctx.fill();
        }
        ctx.restore();

        // Blomsterdunge & fjäril
        ctx.save();
        const fl = s.flowers;
        for (let i = -1; i <= 1; i++) {
          const fx = fl.x + i * 16;
          const fy = fl.y + Math.abs(i) * 5;
          ctx.fillStyle = i === 0 ? '#ff95bd' : '#ffd966';
          ctx.beginPath();
          ctx.arc(fx, fy, 8, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#fff9df';
          ctx.beginPath();
          ctx.arc(fx, fy, 3, 0, TAU);
          ctx.fill();
        }
        if (s.butterPop > 0) {
          const k = 1 - s.butterPop;
          blit(ctx, 'butterfly', fl.x + Math.sin(k * 7) * 28, fl.y - 24 - k * 54, { h: 40 });
        }
        ctx.restore();

        // Studsande musiksvampar
        for (const sh of s.shrooms) {
          drawMushroom(ctx, sh.x, sh.y, 17, sh.color, sh.squash);
        }

        // Eldfluge-spår när en unge guidas hem
        for (const tr of s.trail) {
          ctx.save();
          ctx.globalAlpha = tr.t * 0.85;
          ctx.fillStyle = '#fff3a1';
          ctx.beginPath(); ctx.arc(tr.x, tr.y, 4 + tr.t * 4, 0, TAU); ctx.fill();
          ctx.restore();
        }
        // Eldflugor
        for (const mt of s.motes) {
          if (mt.cd > 0) continue;
          const fx = mt.x + Math.sin(mt.t * 2) * 16;
          const fy = mt.y + Math.cos(mt.t * 2.5) * 10;
          ctx.save();
          const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 18);
          g.addColorStop(0, 'rgba(255, 245, 168, 0.95)');
          g.addColorStop(1, 'rgba(255, 245, 168, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fx, fy, 18, 0, TAU);
          ctx.fill();
          ctx.restore();
        }

        // Mammor (med gyllene aura när deras unge bärs/dras!)
        for (const a of s.animals) {
          const matchActive = activeBaby === a;
          if (matchActive) {
            drawGlowRing(ctx, T, a.mx, a.my - 28, 40, 'rgba(255, 212, 76, 0.95)');
          } else if (!a.reunited && !a.hid) {
            drawGlowRing(ctx, T, a.mx, a.my - 28, 32, 'rgba(255, 232, 150, 0.45)');
          }
          const bob = (matchActive ? Math.sin(T * 8) * 5 : Math.sin(T * 2.5 + a.mx) * 2)
            - (a.hugT > 0 ? Math.sin(a.hugT * Math.PI) * 12 : 0);
          drawShadow(ctx, a.mx, a.my + 2, 24, 7);
          blit(ctx, a.id, a.mx, a.my + bob, { h: 78, face: a.mx > W * 0.5 ? -1 : 1 });

          if (a.callT > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 220, 110, ${a.callT * 0.85})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([7, 7]);
            ctx.beginPath();
            ctx.moveTo(a.mx, a.my - 24);
            ctx.lineTo(a.hid ? a.hx : a.x, (a.hid ? a.hy : a.y) - 18);
            ctx.stroke();
            ctx.restore();
          }
          if (a.reunited) {
            // Litet svävande hjärta över återförenad familj
            const hb = Math.sin(T * 3 + a.mx) * 4;
            ctx.save();
            ctx.translate(a.mx, a.my - 82 + hb);
            ctx.fillStyle = '#ff7da4';
            drawHeartPath(ctx, 9);
            ctx.fill();
            ctx.restore();
          }
        }

        // Gömställen (vickar & glöder tydligt!)
        for (const a of s.animals) {
          if (!a.hid) continue;
          const wig = Math.sin(T * 4.5 + a.hx) * 0.08;
          ctx.save();
          ctx.translate(a.hx, a.hy);
          ctx.rotate(wig);
          drawGlowRing(ctx, T, 0, -20, 34, 'rgba(255, 224, 120, 0.55)');
          drawShadow(ctx, 0, 2, 28, 8);
          if (a.hideKind === 'bush') {
            // Öron som kikar upp ibland!
            const peek = Math.max(0, Math.sin(T * 2.2)) * 12;
            ctx.fillStyle = '#f2dfd0';
            ctx.strokeStyle = '#785a46';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(-8, -36 - peek, 5, 13, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(8, -36 - peek, 5, 13, 0.15, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#3f6e3a';
            ctx.lineWidth = 2;
            for (const [bx, by, br, col] of [[-18, -16, 18, '#6eb568'], [16, -15, 17, '#64a85d'], [0, -26, 22, '#7bc474']]) {
              ctx.fillStyle = col;
              ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke();
            }
            ctx.fillStyle = '#bfe89c';
            for (const [lx, ly] of [[-12, -24], [6, -34], [18, -18]]) {
              ctx.beginPath(); ctx.ellipse(lx, ly, 6, 3, -0.4, 0, TAU); ctx.fill();
            }
          } else if (a.hideKind === 'flower') {
            ctx.fillStyle = '#5da453';
            ctx.fillRect(-3, -24, 6, 24);
            for (let k = 0; k < 6; k++) {
              const ang = (k / 6) * TAU + T * 0.4;
              ctx.fillStyle = k % 2 === 0 ? '#ffd85d' : '#ffbf49';
              ctx.beginPath();
              ctx.ellipse(Math.cos(ang) * 15, -28 + Math.sin(ang) * 15, 11, 7, ang, 0, TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#b96928';
            ctx.beginPath(); ctx.arc(0, -28, 10, 0, TAU); ctx.fill();
          } else if (a.hideKind === 'log') {
            ctx.fillStyle = '#8b623f';
            ctx.strokeStyle = '#4e341e';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(-30, -28, 60, 28, 12); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#462e1b';
            ctx.beginPath(); ctx.ellipse(22, -14, 9, 12, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#77b762';
            ctx.beginPath(); ctx.arc(-14, -27, 9, Math.PI, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -27, 7, Math.PI, TAU); ctx.fill();
          }
          ctx.restore();
        }

        // Guldkurva från aktiv unge till dess mamma
        if (activeBaby) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 220, 92, 0.85)';
          ctx.lineWidth = 5;
          ctx.setLineDash([10, 10]);
          ctx.lineDashOffset = -T * 36;
          ctx.beginPath();
          ctx.moveTo(activeBaby.x, activeBaby.y - 20);
          ctx.quadraticCurveTo(
            (activeBaby.x + activeBaby.mx) / 2,
            Math.min(activeBaby.y, activeBaby.my) - 54,
            activeBaby.mx,
            activeBaby.my - 26,
          );
          ctx.stroke();
          ctx.restore();
        }

        // Båda systrarna! (Den andra systern hejar, båda dansar glädjedans vid 4/4)
        const leadId = api.sister;
        const buddyId = leadId === 'nila' ? 'norin' : 'nila';
        const heroScale = Math.min(W, H) < 460 ? 1.05 : 1.22;

        if (!api.levelWon) {
          s.stage.lead.jump = Math.max(s.stage.lead.jump, s.heroJump);
          s.stage.buddy.jump = Math.max(s.stage.buddy.jump, s.buddyJump);
          if (s.idleT > 2.8) s.stage.lead.expr = 'busig';
          else if (s.heroExprT > 0) s.stage.lead.expr = s.heroExpr;
          s.stage.lead.walkPhase = T * 2.2;
        }
        drawHeroStage(ctx, T, s.stage, {
          leadId, buddyId, scale: heroScale, buddyScale: heroScale * 0.94,
          won: api.levelWon,
          leadPose: s.dragging ? 'walk' : 'idle',
          buddyPose: 'idle',
        });

        // Rita djurungarna (framför/vid systern)
        for (const a of s.animals) {
          if (a.hid) continue;
          const isHeld = s.dragging === a || s.carried === a;
          const sc = (isHeld ? 1.18 : 1) * (a.popT < 1 ? (0.4 + 0.6 * a.popT) : 1);
          const hop = a.reunited
            ? Math.sin(T * 3.5 + a.mx) * 3 - (a.hugT > 0 ? Math.sin(a.hugT * Math.PI) * 16 : 0)
            : (isHeld ? -6 : -Math.abs(Math.sin(T * 3.2 + a.hx)) * 7);
          if (!a.reunited && !isHeld) {
            drawGlowRing(ctx, T, a.x, a.y - 22, 28, 'rgba(255, 224, 110, 0.75)');
          }
          drawShadow(ctx, a.x, a.y + 2, 16 * sc, 5 * sc, isHeld ? 0.14 : 0.24);
          blit(ctx, `${a.id}-baby`, a.x, a.y + hop, { h: 58 * sc, face: a.x < a.mx ? 1 : -1 });
        }

        // Visuell pekhand: första 3s eller om man tvekar > 2.8s
        if (!api.won && (!s.firstDone || s.idleT > 2.8)) {
          const rev = s.carried || s.animals.find((a) => !a.hid && !a.reunited);
          if (rev && !s.dragging) {
            drawGuideHand(ctx, T, rev.x, rev.y - 20, rev.mx, rev.my - 26);
          } else {
            const hidden = s.animals.find((a) => a.hid);
            if (hidden) drawGuideHand(ctx, T, hidden.hx + 8, hidden.hy - 18);
          }
        }
      },
    };
  },
};
