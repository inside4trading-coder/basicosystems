import { useEffect, useRef } from "react";

/**
 * Esfera de confeti en WebGL2, sin librerías.
 *
 * La esfera no se traslada: se queda en su sitio y **rueda sobre su propio eje**.
 * El puntero no la arrastra, le imprime velocidad angular —como empujar una rueda
 * pesada— y al soltar conserva la inercia hasta frenarse.
 *
 * Cada pieza alcanza el ángulo del conjunto con su propia prontitud: las rezagadas
 * se quedan atrás mientras el giro acelera y se realinean cuando se estabiliza. De
 * ahí la torsión. El desfase depende de la *velocidad* y no del ángulo acumulado,
 * que es lo que evita que la esfera se deshaga con el tiempo.
 *
 * Se dibuja con quads instanciados y una sola llamada: los point sprites no sirven
 * porque `gl_PointCoord` está alineado a los ejes y las piezas no podrían girar.
 */

/* Quad instanciado con rotación propia. Cada pieza gira sobre su eje, no se
   orienta según su velocidad: eso es lo que da la sensación de papel. */
const VS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec4 aPos;    // x, y (px), ángulo, escala
in vec2 aMod;    // alpha, color asignado (0 rojo · 1 gris · 2 blanco)
uniform vec2 uRes; uniform vec3 uRed; uniform vec3 uGrey; uniform vec3 uWhite;
out vec2 vUV; out float vA; out vec3 vCol;

/* Tres colores planos. Se resuelve aquí, por vértice, en lugar de por
   píxel: mismo resultado, una fracción del coste. */
vec3 palette(float k) {
  if (k < 0.5) return uRed;
  if (k < 1.5) return uGrey;
  return uWhite;
}
void main() {
  float c = cos(aPos.z), s = sin(aPos.z);
  // el "papel" se escorza al girar: ancho modulado por el coseno del ángulo
  vec2 size = vec2(3.48, 7.68) * aPos.w;
  size.x *= 0.35 + 0.65 * abs(cos(aPos.z * 1.7));
  vec2 p = vec2(aCorner.x * size.x, aCorner.y * size.y);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + aPos.xy;
  vec2 clip = (p / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUV = aCorner * 2.0; vA = aMod.x;
  // El color se fija al nacer y no cambia: cada pieza conserva el suyo.
  vCol = palette(aMod.y);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV; in float vA; in vec3 vCol;
uniform vec3 uDark; uniform vec3 uLit;
out vec4 o;
void main() {
  // rectángulo de esquinas suaves: se lee como recorte de papel, no como punto
  vec2 d = abs(vUV) - vec2(0.42, 0.0);
  float m = length(max(d, 0.0));
  // Canto corto. Con la caída anterior (desde 0.62) el degradado ocupaba el
  // 38 % de la pieza: medido, sólo el 7 % de los píxeles del confeti llegaba a
  // opaco y el conjunto se leía como polvo en vez de como recortes.
  float a = smoothstep(1.0, 0.88, m) * vA;
  if (a < 0.012) discard;
  // Orla: un lado tira a blanco y el opuesto a un azul MÁS OSCURO que el fondo,
  // de modo que la pieza se separa del papel por arriba y por abajo a la vez.
  // Contra un azul de luminosidad media eso separa mucho mejor que un solo
  // filo, y juntos leen como papel satinado con una luz encima.
  // Acaba en 0.85, justo antes de que empiece la caída de alfa en 0.88: si se
  // solapara, el contorno oscuro saldría translúcido y no llegaría a oscurecer
  // el fondo, que es lo único que lo hace visible.
  float orla = smoothstep(0.45, 0.85, m);
  float lado = vUV.y * 0.5 + 0.5;                 // 0 abajo · 1 arriba
  float luz = smoothstep(0.3, 0.7, lado);
  vec3 borde = mix(uDark, uLit, luz);
  // El lado en sombra necesita sustitución completa; el iluminado no. La razón
  // es la luminancia del fondo: #0000AA vale 0.048 porque el azul sólo aporta
  // un 7 %. Dejar pasar un 10 % de una pieza blanca ya suma 0.072 sólo por el
  // canal verde, más que el fondo entero, y el filo sale MÁS claro en vez de
  // más oscuro. Medido: con mezcla al 90 % no había un solo píxel por debajo
  // del fondo.
  float fuerza = mix(1.0, 0.85, luz);
  vec3 col = mix(vCol, borde, orla * fuerza);
  o = vec4(col * a, a);        // premultiplicado; el color ya viene resuelto
}`;

/* Geometría del toroide, en unidades del radio de encuadre.
   RING + TUBE = 1.06 mantiene la envolvente exterior de la esfera anterior;
   RING − TUBE = 0.30 es el agujero del centro. */
const RING = 0.68;
const TUBE = 0.38;
/* Cabeceo de reposo: sin él el toroide se vería perfectamente de frente y
   plano. Con ~25° se lee como un aro en perspectiva y el agujero queda
   elíptico pero siempre abierto. El tope evita que llegue a verse de canto,
   que es donde el agujero desaparecería. */
const TILT_REST = 0.44;
/* 0.78 rad ≈ 45°: medido, a partir de ~50° el borde superior del aro cae sobre
   el agujero y éste se cierra en pantalla. El tope lo mantiene siempre abierto,
   incluso durante un gesto brusco. */
const TILT_MAX = 0.78;
const SPIN_MAX = 1.3;

const hex = (h: string): [number, number, number] => {
  const v = h.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  ];
};

export default function ConfettiSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Los gestos se escuchan en el contenedor (el hero), no en el canvas: el
    // titular ocupa media pantalla y se tragaría el arrastre.
    const host = canvas.parentElement ?? canvas;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Todo lo que haya que deshacer al desmontar se acumula aquí. Es la única
       diferencia real con el prototipo: allí la página nunca se destruía. */
    const teardown: Array<() => void> = [];
    let rafId = 0;
    const stopRaf = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };
    teardown.push(stopRaf);

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      fallback2D();
      return () => teardown.forEach((fn) => fn());
    }

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program");
    }
    gl.useProgram(prog);

    /* Paleta cerrada de tres colores planos, sin mezclas intermedias.
       El rojo va un punto más luminoso que el `--accent` de la interfaz:
       #EA191D sobre #0000AA apenas se diferencia en luminancia —vibra pero no
       separa—, y las piezas rojas se hundían más que las blancas. El rojo de
       botones y kickers se queda en #EA191D; esto es sólo el confeti. */
    const RED = hex("#FF3B3F"), GREY = hex("#B3B3B3"), WHITE = hex("#ffffff");
    /* Azul más oscuro que el fondo (#0000AA): es el que cierra el contorno por
       el lado en sombra. Tiene que ser más oscuro, no igual, o el filo se
       disuelve en el papel — que es justo lo que pasaba antes. */
    const DARK = hex("#000060");
    gl.uniform3f(gl.getUniformLocation(prog, "uRed"), ...RED);
    gl.uniform3f(gl.getUniformLocation(prog, "uGrey"), ...GREY);
    gl.uniform3f(gl.getUniformLocation(prog, "uWhite"), ...WHITE);
    gl.uniform3f(gl.getUniformLocation(prog, "uDark"), ...DARK);
    gl.uniform3f(gl.getUniformLocation(prog, "uLit"), ...WHITE);

    const MAXN = 3600; // techo del pool: deja margen a monitores grandes
    const x = new Float32Array(MAXN), y = new Float32Array(MAXN);
    const vx = new Float32Array(MAXN), vy = new Float32Array(MAXN);
    const ang = new Float32Array(MAXN), av = new Float32Array(MAXN);
    const sc = new Float32Array(MAXN), cid = new Float32Array(MAXN), al = new Float32Array(MAXN);
    // Sitio de cada pieza dentro de la esfera, en el espacio local del objeto:
    // fijo. Lo que gira es la esfera entera, no cada pieza por su cuenta.
    const ux = new Float32Array(MAXN), uy = new Float32Array(MAXN), uz = new Float32Array(MAXN);
    // Ángulo alcanzado por cada pieza y con qué prontitud sigue al del conjunto:
    // de esa diferencia sale la torsión al acelerar. `myZ` es la vuelta en el
    // plano del anillo; `myT`, el cabeceo.
    const myZ = new Float32Array(MAXN), myT = new Float32Array(MAXN), lag = new Float32Array(MAXN);
    const bph = new Float32Array(MAXN), bfr = new Float32Array(MAXN); // su propia respiración
    const inst = new Float32Array(MAXN * 6);
    let N = 0, W = 0, H = 0, dpr = 1;

    /* Sólo hace falta la última posición para medir el desplazamiento del gesto:
       el puntero ya no atrae ni repele, únicamente imprime giro. */
    const ptr = { on: 0, lx: 0, ly: 0 };
    // Sitio de reposo: a la derecha del texto en ancho; en móvil, la franja libre
    // de arriba (centrado cruzaba el titular).
    const wide = () => W > 900;
    const home = () => (wide() ? { x: W * 0.63, y: H * 0.5 } : { x: W * 0.5, y: H * 0.42 });
    // El radio tiene que caber en el encuadre: si se sale, sólo se ve su zona
    // central —donde la densidad proyectada es plana— y deja de leerse como
    // volumen. Con la respiración (×1.185) esto llega a ~0.53 del lado menor.
    // En estrecho hace falta bastante menos: medido, con 0.45 el aro salía a
    // 905 px de diámetro sobre un buffer de 780 —el 116 % del ancho— y el
    // viewport lo recortaba por los lados.
    const radius = () => Math.min(W, H) * (wide() ? 0.45 : 0.32);
    const cen = { x: 0, y: 0 };
    let breath = 1;
    // Rotación del conjunto, con inercia. `spinZ` es la vuelta sobre el eje del
    // agujero —el que mira al espectador— y es el giro principal: por ahí el
    // toroide rueda sin cerrar el hueco. `tilt` es el cabeceo.
    let spinZ = 0, spinVZ = 0, tilt = TILT_REST, tiltV = 0;
    // Respiración sintética: ondas sin relación armónica más pulsos irregulares.
    let pulse = 0, nextPulse = 0.8;

    function spawn(i: number) {
      // Toroide: un anillo de radio mayor RING con un tubo de radio TUBE
      // alrededor. El agujero del centro mide RING − TUBE.
      //
      // El radio dentro del tubo va por raíz cuadrada, no lineal: el tubo es un
      // disco en sección y con radio lineal el eje se satura y el borde queda
      // vacío. (En la esfera maciza anterior el exponente correcto era 1/3.)
      // El anillo va en el plano XY —el de la pantalla— y el tubo se abre hacia
      // Z. Puesto en XZ el toroide se ve de canto y el agujero no existe para
      // el espectador, que es justo lo que hay que enseñar.
      const u = Math.random() * Math.PI * 2; // vuelta alrededor del anillo
      const v = Math.random() * Math.PI * 2; // vuelta alrededor del tubo
      const rho = Math.sqrt(Math.random()) * TUBE;
      const ring = RING + rho * Math.cos(v);
      ux[i] = ring * Math.cos(u);
      uy[i] = ring * Math.sin(u);
      uz[i] = rho * Math.sin(v);
      myZ[i] = 0; myT[i] = TILT_REST;
      lag[i] = 3.4 + Math.random() * 6.2; // prontitud propia → desfase al acelerar
      // Cada pieza respira a su aire: fase y frecuencia propias. La suma de miles
      // de ciclos desacompasados es lo que rompe el pulso único del conjunto.
      bph[i] = Math.random() * Math.PI * 2;
      bfr[i] = 0.4 + Math.random() * 1.75;
      const R0 = radius();
      x[i] = cen.x + ux[i] * R0;
      y[i] = cen.y + uy[i] * R0;
      vx[i] = 0; vy[i] = 0;
      ang[i] = Math.random() * Math.PI * 2;
      av[i] = (Math.random() - 0.5) * 1.1; // giro propio, suave
      sc[i] = 0.34 + Math.random() * Math.random() * 0.84;
      // Reparto exacto 30 % rojo · 40 % gris · 30 % blanco. Va por índice y no al
      // azar porque con ~2.000 piezas el sorteo se desvía un punto o dos de la
      // proporción pedida; el índice no guarda relación con la posición, que sí
      // es aleatoria, así que la mezcla se ve igual de repartida.
      const slot = i % 10;
      cid[i] = slot < 3 ? 0 : slot < 7 ? 1 : 2; // 0 rojo · 1 gris · 2 blanco
      // Suelo alto a propósito: con el mínimo anterior (0.58, que multiplicado
      // por la profundidad caía a 0.32) las piezas del fondo eran fantasmas.
      al[i] = 0.72 + Math.random() * 0.28;
    }

    const quad = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const bq = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bq);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const lc = gl.getAttribLocation(prog, "aCorner");
    gl.enableVertexAttribArray(lc);
    gl.vertexAttribPointer(lc, 2, gl.FLOAT, false, 0, 0);
    const bi = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bi);
    gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    const lp = gl.getAttribLocation(prog, "aPos");
    const lm = gl.getAttribLocation(prog, "aMod");
    gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(lp, 1);
    gl.enableVertexAttribArray(lm);
    gl.vertexAttribPointer(lm, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(lm, 1);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.round(W * dpr));
      canvas!.height = Math.max(1, Math.round(H * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(uRes, W, H);
      if (!cen.x && !cen.y) { const h = home(); cen.x = h.x; cen.y = h.y; } // arranque
      const want = Math.max(700, Math.min(MAXN, Math.round((W * H) / 620)));
      if (want > N) for (let i = N; i < want; i++) spawn(i);
      N = want;
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    teardown.push(() => ro.disconnect());
    resize();

    /* ── Puntero: imprime giro, no arrastra ── */
    function moveTo(cx: number, cy: number) {
      const r = canvas!.getBoundingClientRect();
      const nx = cx - r.left, ny = cy - r.top;
      const dx = nx - ptr.lx, dy = ny - ptr.ly;
      ptr.lx = nx; ptr.ly = ny;
      if (!ptr.on) { ptr.on = 1; return; } // el primer evento sólo fija el origen
      // Arrastrar en horizontal hace rodar el aro sobre su eje; en vertical lo
      // cabecea. Se acota para que un salto brusco del puntero no lo dispare.
      spinVZ += Math.max(-40, Math.min(40, dx)) * 0.011;
      tiltV -= Math.max(-40, Math.min(40, dy)) * 0.004;
    }

    const onPointerMove = (e: PointerEvent) => moveTo(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) moveTo(t.clientX, t.clientY); };
    const onPointerLeave = () => { ptr.on = 0; };
    // Click o toque: empujón de giro más un golpe de respiración.
    const onPointerDown = (e: PointerEvent) => {
      moveTo(e.clientX, e.clientY);
      pulse += 0.2;
      spinVZ += (Math.random() - 0.5) * 1.6;
      tiltV += (Math.random() - 0.5) * 0.5;
    };
    const opts = { passive: true } as const;
    host.addEventListener("pointermove", onPointerMove, opts);
    host.addEventListener("touchmove", onTouch, opts);
    host.addEventListener("touchstart", onTouch, opts);
    host.addEventListener("pointerleave", onPointerLeave, opts);
    host.addEventListener("pointerdown", onPointerDown, opts);
    teardown.push(() => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("touchmove", onTouch);
      host.removeEventListener("touchstart", onTouch);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
    });

    /* En móvil no hay puntero, así que el scroll es el único gesto disponible.
       Se traduce a lo mismo que hace el ratón —giro más un golpe de respiración—
       y no a un arrastre vertical: arrastrar el conjunto es justo el movimiento
       que descartamos al pasar de disco a volumen. */
    let lastY = scrollY;
    const onScroll = () => {
      const d = scrollY - lastY;
      lastY = scrollY;
      if (!d) return;
      const k = Math.max(-60, Math.min(60, d)); // un salto largo no lo dispara
      // Ganancia alta a propósito: en móvil esto sustituye al ratón, así que un
      // desplazamiento corto tiene que notarse.
      tiltV -= k * 0.011;
      spinVZ += k * 0.015;
      // El desfase de cada pieza ante el tirón es lo que da el arritmo: no
      // todas reaccionan a la vez porque cada una tiene su propia prontitud.
      pulse += Math.min(0.15, Math.abs(k) * 0.0038);
    };
    addEventListener("scroll", onScroll, opts);
    teardown.push(() => removeEventListener("scroll", onScroll));

    let running = false, last = performance.now(), t = 0;

    function frame(now: number) {
      if (!running) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      t += dt;

      // ── La esfera no se traslada: se queda en su sitio y rueda ──
      const h = home();
      cen.x += (h.x - cen.x) * Math.min(1, 6 * dt);
      cen.y += (h.y - cen.y) * Math.min(1, 6 * dt);

      // Inercia: conserva el giro y se va frenando, como una rueda pesada.
      spinVZ *= Math.max(0, 1 - 0.85 * dt);
      // El tope no es estético sino geométrico: las piezas persiguen su destino
      // con un muelle, y por encima de ~1,3 rad/s el desfase les hace recortar
      // la curva hacia dentro hasta tapar el agujero. Medido: sin tope, un
      // gesto brusco lo cerraba por completo.
      spinVZ = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, spinVZ));
      spinZ += (spinVZ + 0.16) * dt; // deriva base: en reposo nunca queda muerto
      // El cabeceo no es libre: vuelve solo al reposo y topa antes de ponerse
      // de canto, que es donde el agujero se cerraría.
      tiltV *= Math.max(0, 1 - 3.4 * dt);
      tiltV += (TILT_REST - tilt) * 3.2 * dt;
      tilt += tiltV * dt;
      if (tilt > TILT_MAX) { tilt = TILT_MAX; tiltV = Math.min(tiltV, 0); }
      if (tilt < -TILT_MAX) { tilt = -TILT_MAX; tiltV = Math.max(tiltV, 0); }

      // ── Respiración sintética: sin periodo estable, con pulsos sueltos ──
      if (t > nextPulse) {
        pulse += 0.05 + Math.random() * 0.11;
        nextPulse = t + 0.28 + Math.random() * 2.1;
      }
      pulse += (0 - pulse) * Math.min(1, 2.6 * dt); // ataque seco, caída larga
      // No hay respiración de conjunto: respirar todas a la vez sonaba a
      // metrónomo. Sólo el golpe del click mueve la esfera entera.
      breath = 1 + pulse;
      const R = radius() * breath;

      for (let i = 0; i < N; i++) {
        // Cada pieza alcanza el ángulo del conjunto con su propia prontitud.
        const k = Math.min(1, lag[i] * dt);
        myZ[i] += (spinZ - myZ[i]) * k;
        myT[i] += (tilt - myT[i]) * k;

        // Respiración propia: se acerca y se aleja del centro a su ritmo.
        const own = 1 + 0.185 * Math.sin(t * bfr[i] + bph[i]);

        // Rotar su sitio en el toroide: primero la vuelta en el plano del aro,
        // luego el cabeceo sobre el eje horizontal.
        const cz = Math.cos(myZ[i]), sz = Math.sin(myZ[i]);
        const rx1 = ux[i] * cz - uy[i] * sz;
        const ry1 = ux[i] * sz + uy[i] * cz;
        const ct = Math.cos(myT[i]), st = Math.sin(myT[i]);
        const ry2 = ry1 * ct - uz[i] * st;
        const rz2 = ry1 * st + uz[i] * ct;

        const rad = R * own;
        const tx = cen.x + rx1 * rad;
        const ty = cen.y + ry2 * rad;
        vx[i] += (tx - x[i]) * 7.0 * dt;
        vy[i] += (ty - y[i]) * 7.0 * dt;

        vx[i] *= 1 - 3.4 * dt;
        vy[i] *= 1 - 3.4 * dt; // amortiguación: llega sin rebotar
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        ang[i] += av[i] * dt;
        av[i] *= 1 - 0.5 * dt;

        // Profundidad: lo que está detrás se ve más pequeño y más tenue. Sin esto
        // la rotación se lee como remolino plano, no como volumen.
        const depth = rz2 / 1.06; // −1 al fondo, +1 al frente
        const dScale = 0.78 + 0.22 * (depth * 0.5 + 0.5);
        // Rango estrecho: la opacidad ya casi no marca la profundidad, de eso
        // se encarga `dScale`. Aquí lo que importa es que las piezas del fondo
        // se vean — son la masa del aro. Si el volumen se pierde, la palanca es
        // abrir `dScale`, no volver a hundir el alfa.
        const dAlpha = 0.72 + 0.28 * (depth * 0.5 + 0.5);

        const o = i * 6;
        inst[o] = x[i]; inst[o + 1] = y[i]; inst[o + 2] = ang[i]; inst[o + 3] = sc[i] * dScale;
        inst[o + 4] = al[i] * dAlpha; inst[o + 5] = cid[i];
      }

      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, bi);
      gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, inst, 0, N * 6);
      gl!.bindVertexArray(vao);
      gl!.drawArraysInstanced(gl!.TRIANGLE_STRIP, 0, 4, N);

      rafId = requestAnimationFrame(frame);
    }
    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; stopRaf(); };
    teardown.push(stop);

    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting && document.visibilityState === "visible" ? start() : stop()),
      { threshold: 0.01 },
    );
    io.observe(canvas);
    teardown.push(() => io.disconnect());

    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);
    teardown.push(() => document.removeEventListener("visibilitychange", onVisibility));

    if (reduced) {
      // un único fotograma: el campo se ve, pero quieto
      running = true;
      frame(performance.now());
      stop();
    } else {
      start();
    }

    // Liberar la GPU explícitamente: sin esto, entrar y salir de la landing va
    // dejando contextos vivos y el navegador acaba descartando los más antiguos.
    teardown.push(() => gl.getExtension("WEBGL_lose_context")?.loseContext());

    /* Respaldo para navegadores sin WebGL2: campo plano que asciende. */
    function fallback2D() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const P: Array<{ x: number; y: number; s: number; a: number; r: number }> = [];
      const cols = ["#8a8a8a", "#B3B3B3", "#e8e8e8"];
      const draw = () => {
        const w = canvas!.clientWidth, h = canvas!.clientHeight;
        const d = Math.min(devicePixelRatio || 1, 2);
        if (canvas!.width !== Math.round(w * d)) {
          canvas!.width = Math.round(w * d);
          canvas!.height = Math.round(h * d);
        }
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!P.length) {
          for (let i = 0; i < 150; i++) {
            P.push({
              x: Math.random() * w, y: Math.random() * h,
              s: 0.5 + Math.random(), a: 0.3 + Math.random() * 0.5,
              r: Math.random() * Math.PI,
            });
          }
        }
        for (const p of P) {
          p.y -= 0.28 * p.s;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = cols[(p.x | 0) % 3];
          ctx.fillRect(-1.4 * p.s, -3 * p.s, 2.8 * p.s, 6 * p.s);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(draw);
      };
      draw();
    }

    return () => teardown.forEach((fn) => fn());
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero__canvas"
      aria-hidden="true"
    />
  );
}
