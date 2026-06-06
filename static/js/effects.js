/**
 * NexGen Weather - Three.js 3D VFX Particle Engine (With Day/Night support)
 * Generates interactive WebGL weather particle simulations
 */

class ThreeWeather {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.particles = null;
        this.particleGeometry = null;
        this.particleMaterial = null;
        this.particleCount = 2000;
        this.activeWeather = null;
        this.animationFrameId = null;

        // Custom meshes for specific scenes (like the sun)
        this.customMeshes = [];

        // Mouse interaction state
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetMouseX = 0;
        this.targetMouseY = 0;

        // Lightning state for storms
        this.lightningFlash = 0;
        this.lightningChance = 0.005; // probability per frame

        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        const isDay = document.body.classList.contains('day-mode');
        const fogColor = isDay ? 0xeef2f6 : 0x070b19;

        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(fogColor, 0.01);

        // 2. Camera setup
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 40;

        // 3. Renderer setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. Lighting setup
        this.ambientLight = new THREE.AmbientLight(0xffffff, isDay ? 0.95 : 0.6);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xfff8e7, isDay ? 1.0 : 0.8);
        this.directionalLight.position.set(5, 15, 10);
        this.scene.add(this.directionalLight);

        // 5. Create procedural particle texture
        this.dotTexture = this.createCircleTexture();

        // 6. Listeners
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // 7. Start Loop
        this.animate();
        
        // Default weather mode
        this.changeWeather('clear');
    }

    // Generate circular gradient texture procedurally
    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        // Draw radial gradient
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    handleResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handleMouseMove(e) {
        this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        this.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    clearVFX() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.particles = null;
        }

        this.customMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        this.customMeshes = [];

        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xeef2f6 : 0x070b19, 0.01);
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = isDay ? 0.95 : 0.6;
        this.directionalLight.color.setHex(isDay ? 0xfff8e7 : 0xffffff);
        this.directionalLight.intensity = isDay ? 1.0 : 0.8;
    }

    changeWeather(type) {
        if (this.activeWeather === type) return;
        this.activeWeather = type;

        this.clearVFX();

        switch (type.toLowerCase()) {
            case 'clear':
            case 'sunny':
                this.createClearVFX();
                break;
            case 'clouds':
            case 'cloudy':
                this.createCloudsVFX();
                break;
            case 'rain':
            case 'rainy':
            case 'drizzle':
                this.createRainVFX();
                break;
            case 'storm':
            case 'thunderstorm':
                this.createStormVFX();
                break;
            case 'snow':
            case 'snowy':
                this.createSnowVFX();
                break;
            case 'mist':
            case 'fog':
            case 'haze':
            case 'smoke':
                this.createMistVFX();
                break;
            default:
                this.createClearVFX();
                break;
        }
    }

    // Triggered externally by the main.js theme toggler
    setDayMode(isDay) {
        if (!this.scene) return;
        
        const fogColor = isDay ? 0xeef2f6 : 0x070b19;
        this.scene.fog.color.setHex(fogColor);
        this.ambientLight.intensity = isDay ? 0.95 : 0.6;
        this.directionalLight.intensity = isDay ? 1.0 : 0.8;
        this.directionalLight.color.setHex(isDay ? 0xfff8e7 : 0xffffff);

        // Rebuild VFX to apply correct colors/blending immediately
        if (this.activeWeather) {
            const current = this.activeWeather;
            this.activeWeather = null; // force rebuild
            this.changeWeather(current);
        }
    }

    // ==========================================
    // Visual Condition Generators
    // ==========================================

    createClearVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xeef2f6 : 0x0a142c, 0.005);
        this.ambientLight.color.setHex(isDay ? 0xffffff : 0xfffaed);
        this.ambientLight.intensity = isDay ? 0.95 : 0.8;

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        // Sunny golden sparks during day, cool silver stars at night
        const pColor = isDay ? 0xffb300 : 0xf1f5f9;
        const count = isDay ? 500 : 800;

        for (let i = 0; i < count; i++) {
            positions.push(
                (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80
            );
            velocities.push(
                (Math.random() - 0.5) * 0.04,
                (Math.random() - 0.5) * 0.04,
                (Math.random() - 0.5) * 0.04
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: pColor,
            size: isDay ? 0.75 : 0.6,
            transparent: true,
            opacity: isDay ? 0.45 : 0.6,
            map: this.dotTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // Rotating Sun/Moon Wireframe Globe
        const sunGeo = new THREE.SphereGeometry(14, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({
            color: isDay ? 0x0ea5e9 : 0xffd700,
            transparent: true,
            opacity: isDay ? 0.06 : 0.12,
            wireframe: true
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.position.set(30, 20, -50);
        this.scene.add(sunMesh);
        this.customMeshes.push(sunMesh);

        // Core glow sphere
        const flareGeo = new THREE.SphereGeometry(7, 16, 16);
        const flareMat = new THREE.MeshBasicMaterial({
            color: isDay ? 0xfffbeb : 0xffeed0,
            transparent: true,
            opacity: isDay ? 0.35 : 0.2,
            blending: THREE.AdditiveBlending
        });
        const flareMesh = new THREE.Mesh(flareGeo, flareMat);
        flareMesh.position.set(30, 20, -50);
        this.scene.add(flareMesh);
        this.customMeshes.push(flareMesh);
    }

    createCloudsVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xd1d5db : 0x0f172a, 0.015);
        this.ambientLight.color.setHex(isDay ? 0xe2e8f0 : 0x94a3b8);
        
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < 350; i++) {
            positions.push(
                (Math.random() - 0.5) * 160,
                (Math.random() - 0.3) * 60,
                (Math.random() - 0.5) * 60
            );
            velocities.push(Math.random() * 0.02 + 0.01);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: isDay ? 0xffffff : 0x64748b,
            size: isDay ? 18 : 15,
            transparent: true,
            opacity: isDay ? 0.22 : 0.14,
            map: this.dotTexture,
            blending: isDay ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // Clouds wireframe shapes
        const cloudGeo = new THREE.DodecahedronGeometry(8, 1);
        const cloudMat = new THREE.MeshLambertMaterial({
            color: isDay ? 0x94a3b8 : 0x1e293b,
            transparent: true,
            opacity: isDay ? 0.16 : 0.1,
            flatShading: true
        });

        for (let i = 0; i < 5; i++) {
            const cluster = new THREE.Mesh(cloudGeo, cloudMat);
            cluster.position.set(
                (Math.random() - 0.5) * 80,
                (Math.random() * 15) + 12,
                -Math.random() * 30 - 10
            );
            const scale = Math.random() * 1.5 + 0.8;
            cluster.scale.set(scale * 2.5, scale, scale);
            this.scene.add(cluster);
            this.customMeshes.push(cluster);
        }
    }

    createRainVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xd4d4d8 : 0x0b132b, 0.02);
        
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < 2200; i++) {
            positions.push(
                (Math.random() - 0.5) * 100,
                Math.random() * 80 - 40,
                (Math.random() - 0.5) * 60
            );
            velocities.push(
                (Math.random() - 0.5) * 0.1 - 0.1,
                -Math.random() * 0.7 - 0.8
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: isDay ? 0x0284c7 : 0xa5f3fc,
            size: 0.45,
            transparent: true,
            opacity: isDay ? 0.55 : 0.65,
            map: this.dotTexture,
            blending: isDay ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    createStormVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xa1a1aa : 0x050814, 0.025);

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < 3000; i++) {
            positions.push(
                (Math.random() - 0.5) * 100,
                Math.random() * 80 - 40,
                (Math.random() - 0.5) * 60
            );
            velocities.push(
                -0.4 - Math.random() * 0.3,
                -1.2 - Math.random() * 0.9
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: isDay ? 0x0369a1 : 0x93c5fd,
            size: 0.5,
            transparent: true,
            opacity: isDay ? 0.6 : 0.7,
            map: this.dotTexture,
            blending: isDay ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        const stormGeo = new THREE.DodecahedronGeometry(12, 1);
        const stormMat = new THREE.MeshBasicMaterial({
            color: isDay ? 0x4b5563 : 0x0f172a,
            transparent: true,
            opacity: isDay ? 0.15 : 0.25,
            wireframe: true
        });

        for (let i = 0; i < 3; i++) {
            const darkCloud = new THREE.Mesh(stormGeo, stormMat);
            darkCloud.position.set(
                (Math.random() - 0.5) * 60,
                25,
                -30 - Math.random() * 10
            );
            this.scene.add(darkCloud);
            this.customMeshes.push(darkCloud);
        }
    }

    createSnowVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xe2e8f0 : 0x0e1726, 0.015);

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < 1600; i++) {
            positions.push(
                (Math.random() - 0.5) * 100,
                Math.random() * 80 - 40,
                (Math.random() - 0.5) * 60
            );
            velocities.push(
                (Math.random() - 0.5) * 0.08,
                -Math.random() * 0.15 - 0.08,
                (Math.random() - 0.5) * 0.05
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: isDay ? 0.95 : 0.85,
            transparent: true,
            opacity: isDay ? 0.75 : 0.8,
            map: this.dotTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    createMistVFX() {
        const isDay = document.body.classList.contains('day-mode');
        this.scene.fog = new THREE.FogExp2(isDay ? 0xe2e8f0 : 0x111827, 0.035);

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < 800; i++) {
            positions.push(
                (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 60,
                (Math.random() - 0.5) * 60
            );
            velocities.push(
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.02
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: isDay ? 0xffffff : 0xe2e8f0,
            size: isDay ? 7 : 6,
            transparent: true,
            opacity: isDay ? 0.18 : 0.15,
            map: this.dotTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    // ==========================================
    // Render loop animation & interactions
    // ==========================================

    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
        this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

        if (this.camera) {
            this.camera.position.x = this.mouseX * 8;
            this.camera.position.y = this.mouseY * 6;
            this.camera.lookAt(this.scene.position);
        }

        if (this.particles) {
            const posAttr = this.particles.geometry.attributes.position;
            const array = posAttr.array;
            const vels = this.particles.geometry.userData.velocities;
            const length = array.length;

            if (this.activeWeather === 'clear' || this.activeWeather === 'sunny' || this.activeWeather === 'mist' || this.activeWeather === 'fog') {
                for (let i = 0; i < length; i += 3) {
                    const idx = i / 3;
                    array[i] += vels[idx * 3] + Math.sin(elapsed + idx) * 0.005;
                    array[i + 1] += vels[idx * 3 + 1] + Math.cos(elapsed * 0.5 + idx) * 0.005;
                    array[i + 2] += vels[idx * 3 + 2];

                    if (Math.abs(array[i]) > 70) array[i] = -array[i] * 0.95;
                    if (Math.abs(array[i + 1]) > 50) array[i + 1] = -array[i + 1] * 0.95;
                }
            } 
            else if (this.activeWeather === 'clouds' || this.activeWeather === 'cloudy') {
                for (let i = 0; i < length; i += 3) {
                    const idx = i / 3;
                    array[i] += vels[idx];
                    array[i + 1] += Math.sin(elapsed * 0.2 + idx) * 0.01;
                    if (array[i] > 80) array[i] = -80;
                }
            }
            else if (this.activeWeather === 'rain' || this.activeWeather === 'rainy' || this.activeWeather === 'drizzle') {
                for (let i = 0; i < length; i += 3) {
                    const idx = i / 3;
                    array[i] += vels[idx * 2];
                    array[i + 1] += vels[idx * 2 + 1];

                    if (array[i + 1] < -35) {
                        array[i + 1] = 40;
                        array[i] = (Math.random() - 0.5) * 100;
                    }
                }
            }
            else if (this.activeWeather === 'storm' || this.activeWeather === 'thunderstorm') {
                this.handleLightning(delta);

                for (let i = 0; i < length; i += 3) {
                    const idx = i / 3;
                    array[i] += vels[idx * 2];
                    array[i + 1] += vels[idx * 2 + 1];

                    if (array[i + 1] < -35) {
                        array[i + 1] = 40;
                        array[i] = (Math.random() - 0.3) * 100;
                    }
                }
            }
            else if (this.activeWeather === 'snow' || this.activeWeather === 'snowy') {
                for (let i = 0; i < length; i += 3) {
                    const idx = i / 3;
                    array[i] += vels[idx * 3] + Math.sin(elapsed + idx) * 0.04;
                    array[i + 1] += vels[idx * 3 + 1];
                    array[i + 2] += vels[idx * 3 + 2];

                    if (array[i + 1] < -35) {
                        array[i + 1] = 45;
                        array[i] = (Math.random() - 0.5) * 100;
                    }
                }
            }

            posAttr.needsUpdate = true;
        }

        this.customMeshes.forEach((mesh, index) => {
            if (this.activeWeather === 'clear' || this.activeWeather === 'sunny') {
                if (index === 0) mesh.rotation.y += 0.001;
                if (index === 1) mesh.rotation.x += 0.002;
            } else if (this.activeWeather === 'clouds' || this.activeWeather === 'cloudy') {
                mesh.position.x += 0.008;
                if (mesh.position.x > 80) mesh.position.x = -80;
            } else if (this.activeWeather === 'storm') {
                mesh.rotation.y += 0.002;
            }
        });

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    handleLightning(delta) {
        const isDay = document.body.classList.contains('day-mode');
        const defaultColor = isDay ? 0xeef2f6 : 0x384259;
        const baseIntensity = isDay ? 0.95 : 0.3;

        if (this.lightningFlash > 0) {
            this.lightningFlash -= delta * 15;
            
            if (this.lightningFlash < 0) this.lightningFlash = 0;

            const intensity = baseIntensity + this.lightningFlash * 1.8;
            this.ambientLight.intensity = intensity;
            this.directionalLight.intensity = intensity * 1.5;

            if (this.lightningFlash > 0.5) {
                this.ambientLight.color.setHex(isDay ? 0xffffff : 0xb2ebf2);
            } else {
                this.ambientLight.color.setHex(defaultColor);
            }
        } else {
            if (Math.random() < this.lightningChance) {
                this.lightningFlash = 1.0;
                this.ambientLight.intensity = 2.0;

                if (window.triggerScreenShake) {
                    window.triggerScreenShake();
                }
            }
        }
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', () => this.handleResize());
        this.clearVFX();
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
