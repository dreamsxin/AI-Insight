/** A plain-language, rotatable 3D map of the Transformer information journey. */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BaseVisualization } from "@/visualizations/BaseVisualization";

interface Stage {
  daily: string;
  term: string;
  explanation: string;
  color: number;
}

interface StageView {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  material: THREE.MeshStandardMaterial;
}

export const ARCHITECTURE_STAGES: Stage[] = [
  { daily: "把词变成数字", term: "Embedding", explanation: "每个词先换成一组数字，机器才有办法处理它。", color: 0x35c8ff },
  { daily: "加上先后顺序", term: "Position", explanation: "给每个词标上位置，模型知道谁在前、谁在后。", color: 0x35c8ff },
  { daily: "找出重点", term: "Self-Attention", explanation: "每个词都看看其他词，判断哪些信息和自己最有关。", color: 0x8b7cff },
  { daily: "逐项加工", term: "Feed Forward", explanation: "把刚才找到的重点再加工一次，整理成更有用的表示。", color: 0x8b7cff },
  { daily: "开始写答案", term: "Decoder Input", explanation: "生成答案时，从已经写出的内容开始继续往下写。", color: 0xffa64d },
  { daily: "只看已经写过的", term: "Masked Attention", explanation: "写到哪儿只能看前面，不能偷看还没写出的词。", color: 0xffa64d },
  { daily: "参考输入内容", term: "Cross Attention", explanation: "写答案时回头查阅输入，找到真正需要的原文信息。", color: 0xffa64d },
  { daily: "再整理一遍", term: "Feed Forward", explanation: "把综合后的信息再次加工，让答案更清楚。", color: 0xffa64d },
  { daily: "选出下一个词", term: "Softmax", explanation: "给候选词排队，挑出最合适的下一个词。", color: 0x55d68b },
];

const SURFACE = 0x111a24;
const MUTED = 0x7d8d9e;

export function architecturePositions(width: number): THREE.Vector3[] {
  const compact = width < 620;
  const columns = compact ? 3 : 5;
  const xGap = compact ? 2.7 : 2.5;
  const zGap = compact ? 2.4 : 2.1;
  return ARCHITECTURE_STAGES.map((_, index) => {
    const row = Math.floor(index / columns);
    const positionInRow = index % columns;
    const column = row % 2 === 0 ? positionInRow : columns - positionInRow - 1;
    return new THREE.Vector3(
      (column - (columns - 1) / 2) * xGap,
      0,
      (row - (Math.ceil(ARCHITECTURE_STAGES.length / columns) - 1) / 2) * zGap,
    );
  });
}

export class ArchitectureViz extends BaseVisualization {
  private scene3d: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private threeRenderer: THREE.WebGLRenderer | null = null;
  private orbit: OrbitControls | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private stageViews: StageView[] = [];
  private connector: THREE.LineSegments | null = null;
  private token: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null = null;
  private detailEl: HTMLElement | null = null;
  private animationFrame = 0;
  private journeyElapsed = 0;
  private journeyRunning = false;
  private journeyPaused = false;
  private journeyStartedAt = 0;
  private lastFrame = 0;
  private selectedIndex = 0;
  private stagePositions: THREE.Vector3[] = [];
  private readonly onPointerDown = (event: PointerEvent): void => this.handlePointer(event);

  override start(): void {
    this.onMount();
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  onMount(): void {
    this.canvas.style.display = "none";
    this.container.classList.add("canvas-container--3d");
    this.detailEl = document.createElement("div");
    this.detailEl.className = "architecture-detail";
    this.detailEl.setAttribute("aria-live", "polite");
    this.container.appendChild(this.detailEl);

    try {
      this.scene3d = new THREE.Scene();
      this.scene3d.fog = new THREE.FogExp2(0x0b1118, 0.028);
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      this.threeRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
      this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.threeRenderer.setClearColor(0x0b1118, 1);
      this.threeRenderer.domElement.className = "architecture-canvas";
      this.threeRenderer.domElement.setAttribute("role", "img");
      this.threeRenderer.domElement.setAttribute("aria-label", "可旋转的 Transformer 信息旅程 3D 图");
      this.container.insertBefore(this.threeRenderer.domElement, this.detailEl);
      this.orbit = new OrbitControls(this.camera, this.threeRenderer.domElement);
      this.orbit.enableDamping = true;
      this.orbit.dampingFactor = 0.08;
      this.orbit.minDistance = 7;
      this.orbit.maxDistance = 22;
      this.orbit.target.set(0, 0, 0);
      this.scene3d.add(new THREE.AmbientLight(0x9fb3c8, 1.8));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
      keyLight.position.set(-4, 8, 7);
      this.scene3d.add(keyLight);
      const rimLight = new THREE.PointLight(0x367dff, 22, 18, 2);
      rimLight.position.set(4, 3, -5);
      this.scene3d.add(rimLight);
      this.buildScene();
      this.threeRenderer.domElement.addEventListener("pointerdown", this.onPointerDown);
      this.resize();
      this.selectStage(this.focus);
    } catch (error) {
      this.setVisualizationStatus("error");
      this.detailEl.textContent = "3D 画布暂时无法启动，请刷新页面后重试。";
      console.error("Failed to initialize 3D architecture", error);
    }
  }

  override onControlChange(key: string, value: number): void {
    if (key === "run") {
      this.playJourney();
      return;
    }
    if (key === "focus" && !this.journeyRunning) this.selectStage(value);
  }

  override pause(): void {
    if (!this.journeyRunning || this.journeyPaused) return;
    this.journeyPaused = true;
    this.setVisualizationStatus("paused");
  }

  override resume(): void {
    if (!this.journeyRunning || !this.journeyPaused) return;
    this.journeyPaused = false;
    this.journeyStartedAt = performance.now() - this.journeyElapsed;
    this.setVisualizationStatus("running");
  }

  override resize(): void {
    super.resize();
    if (!this.threeRenderer || !this.camera) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, rect.width || 600);
    const height = Math.max(330, rect.height || 480) - (this.detailEl?.getBoundingClientRect().height ?? 0);
    this.threeRenderer.setSize(width, height, false);
    this.threeRenderer.domElement.style.width = "100%";
    this.threeRenderer.domElement.style.height = `${height}px`;
    this.camera.aspect = width / Math.max(240, height);
    const compact = width < 620;
    const wide = width > 760;
    const horizontalTarget = compact ? 2.2 : 0;
    this.orbit?.target.set(horizontalTarget, 0, 0);
    this.camera.position.set(
      0,
      compact ? 9.6 : wide ? 7.1 : 7.8,
      compact ? 12.8 : wide ? 10.8 : 12.3,
    );
    this.camera.lookAt(horizontalTarget, 0, 0);
    this.camera.updateProjectionMatrix();
    this.stagePositions = architecturePositions(width);
    this.stageViews.forEach((view, index) => view.group.position.copy(this.stagePositions[index]));
    this.updateConnector();
    if (this.token && this.stagePositions[this.selectedIndex]) {
      this.token.position.copy(this.stagePositions[this.selectedIndex]).add(new THREE.Vector3(0, 0.78, 0));
    }
  }

  override onUnmount(): void {
    cancelAnimationFrame(this.animationFrame);
    this.threeRenderer?.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.orbit?.dispose();
    this.scene3d?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => this.disposeMaterial(item));
      else if (material) this.disposeMaterial(material);
    });
    this.threeRenderer?.dispose();
    this.threeRenderer?.domElement.remove();
    this.detailEl?.remove();
    this.container.classList.remove("canvas-container--3d");
    this.scene3d = null;
    this.camera = null;
    this.threeRenderer = null;
    this.orbit = null;
  }

  private get focus(): number {
    return Math.max(0, Math.min(ARCHITECTURE_STAGES.length - 1, Math.floor(this.controls["focus"] ?? 0)));
  }

  private buildScene(): void {
    if (!this.scene3d) return;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 18),
      new THREE.MeshStandardMaterial({ color: SURFACE, roughness: 0.95, metalness: 0.05, transparent: true, opacity: 0.72 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    this.scene3d.add(floor);

    this.stageViews = ARCHITECTURE_STAGES.map((stage, stageIndex) => {
      const material = new THREE.MeshStandardMaterial({
        color: stage.color,
        emissive: stage.color,
        emissiveIntensity: 0.08,
        roughness: 0.46,
        metalness: 0.22,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 1.15), material);
      mesh.userData.stageIndex = stageIndex;
      const group = new THREE.Group();
      group.add(mesh);
      group.add(this.makeLabel(stage));
      this.scene3d!.add(group);
      return { group, mesh, material };
    });

    this.connector = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x6f8498, transparent: true, opacity: 0.58 }),
    );
    this.scene3d.add(this.connector);
    this.token = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9f1c, emissiveIntensity: 2.2, roughness: 0.2 }),
    );
    this.scene3d.add(this.token);
  }

  private makeLabel(stage: Stage): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 170;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 36px system-ui, sans-serif";
    ctx.fillStyle = "#f1f6fb";
    ctx.fillText(stage.daily, canvas.width / 2, 62);
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.fillStyle = "#aab9c8";
    ctx.fillText(stage.term, canvas.width / 2, 116);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(2.5, 0.67, 1);
    sprite.position.y = 0.08;
    return sprite;
  }

  private disposeMaterial(material: THREE.Material): void {
    const materialWithMap = material as THREE.Material & { map?: THREE.Texture | null };
    materialWithMap.map?.dispose();
    material.dispose();
  }

  private updateConnector(): void {
    if (!this.connector || this.stagePositions.length < 2) return;
    const points: number[] = [];
    for (let i = 0; i < this.stagePositions.length - 1; i++) {
      const a = this.stagePositions[i].clone().setY(0.03);
      const b = this.stagePositions[i + 1].clone().setY(0.03);
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    this.connector.geometry.dispose();
    this.connector.geometry = new THREE.BufferGeometry();
    this.connector.geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  }

  private selectStage(index: number): void {
    const safeIndex = Math.max(0, Math.min(ARCHITECTURE_STAGES.length - 1, Math.round(index)));
    this.selectedIndex = safeIndex;
    this.setControlValue("focus", safeIndex);
    this.stageViews.forEach((view, stageIndex) => {
      const selected = stageIndex === safeIndex;
      view.material.emissiveIntensity = selected ? 0.72 : 0.08;
      view.material.opacity = selected ? 1 : 0.72;
      view.material.transparent = !selected;
      view.group.scale.setScalar(selected ? 1.06 : 1);
    });
    const stage = ARCHITECTURE_STAGES[safeIndex];
    if (this.detailEl) {
      this.detailEl.innerHTML = `<strong>${stage.daily}</strong><span>${stage.explanation}</span><small>专业名称：${stage.term}</small>`;
    }
    if (this.token && this.stagePositions[safeIndex] && !this.journeyRunning) {
      this.token.position.copy(this.stagePositions[safeIndex]).add(new THREE.Vector3(0, 0.78, 0));
    }
  }

  private playJourney(): void {
    if (!this.threeRenderer || this.journeyRunning) return;
    this.journeyRunning = true;
    this.journeyPaused = false;
    this.journeyElapsed = 0;
    this.journeyStartedAt = performance.now();
    this.setVisualizationStatus("running");
    this.selectStage(0);
  }

  private handlePointer(event: PointerEvent): void {
    if (!this.threeRenderer || !this.camera) return;
    const rect = this.threeRenderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.stageViews.map((view) => view.mesh), false)[0];
    const index = hit?.object.userData.stageIndex;
    if (typeof index === "number") {
      this.journeyRunning = false;
      this.journeyPaused = false;
      this.setVisualizationStatus("idle");
      this.selectStage(index);
    }
  }

  private readonly renderFrame = (now: number): void => {
    if (!this.threeRenderer || !this.scene3d || !this.camera) return;
    const dt = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
    if (this.journeyRunning && !this.journeyPaused && this.stagePositions.length) {
      this.journeyElapsed = now - this.journeyStartedAt;
      const segmentMs = 900;
      const total = segmentMs * (ARCHITECTURE_STAGES.length - 1);
      const progress = Math.min(1, this.journeyElapsed / total);
      const segment = Math.min(ARCHITECTURE_STAGES.length - 2, Math.floor(progress * (ARCHITECTURE_STAGES.length - 1)));
      const localProgress = (progress * (ARCHITECTURE_STAGES.length - 1)) - segment;
      this.selectStage(Math.round(progress * (ARCHITECTURE_STAGES.length - 1)));
      const from = this.stagePositions[segment];
      const to = this.stagePositions[Math.min(segment + 1, this.stagePositions.length - 1)];
      this.token?.position.lerpVectors(from, to, localProgress).add(new THREE.Vector3(0, 0.78 + Math.sin(now / 150) * 0.08, 0));
      if (progress >= 1) {
        this.journeyRunning = false;
        this.setVisualizationStatus("completed");
        this.selectStage(ARCHITECTURE_STAGES.length - 1);
      }
    }
    if (this.token) this.token.rotation.y += dt * 0.002;
    this.orbit?.update();
    this.threeRenderer.render(this.scene3d, this.camera);
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  };
}
