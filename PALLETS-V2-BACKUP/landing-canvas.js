/**
 * PALLETS // High-Tech Starfield & Data Matrix Particle Canvas
 * Aesthetic: VISTA.IO cyber-minimalism · Deep midnight starfield with glowing nodes
 */

(function () {
  'use strict';

  class LandingParticleCanvas {
    constructor() {
      this.canvas = document.getElementById('landing-particle-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.floatingTags = [];
      this.width = 0;
      this.height = 0;
      this.animationFrame = null;
      this.isVisible = true;

      this.mouse = {
        x: null,
        y: null,
        radius: 120
      };

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());

      // Interactive mouse parallax
      window.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (e.clientY <= rect.bottom && e.clientY >= rect.top) {
          this.mouse.x = e.clientX - rect.left;
          this.mouse.y = e.clientY - rect.top;
        } else {
          this.mouse.x = null;
          this.mouse.y = null;
        }
      });

      // Pause when scrolled out of view to save battery / GPU
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            this.isVisible = entry.isIntersecting;
            if (this.isVisible && !this.animationFrame) {
              this.animate();
            }
          });
        }, { threshold: 0.05 });
        observer.observe(this.canvas);
      }

      this.createParticles();
      this.createTags();
      this.animate();
    }

    resize() {
      if (!this.canvas) return;
      this.width = this.canvas.width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
      this.height = this.canvas.height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;
      this.createParticles();
    }

    createParticles() {
      this.particles = [];
      const count = Math.min(140, Math.floor((this.width * this.height) / 8500));
      const colors = ['#2563EB', '#38BDF8', '#10B981', '#60A5FA', '#F8FAFC', '#F43F5E'];

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: Math.random() * 1.8 + 0.6,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: Math.random() * 0.7 + 0.2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
          pulse: Math.random() * Math.PI
        });
      }
    }

    createTags() {
      this.floatingTags = [
        { label: 'BLR_NORTH · 99.4% STABLE', x: 0.18, y: 0.32, vx: 0.08, vy: -0.05 },
        { label: 'MUM_BANDRA · COLD CHAIN', x: 0.78, y: 0.28, vx: -0.06, vy: 0.07 },
        { label: 'DEL_GURGAON · DISPATCH 200 OK', x: 0.68, y: 0.72, vx: -0.05, vy: -0.06 },
        { label: 'SNS_AGENT #CC0A6272', x: 0.15, y: 0.68, vx: 0.07, vy: 0.06 }
      ];
    }

    animate() {
      if (!this.isVisible) {
        this.animationFrame = null;
        return;
      }

      this.ctx.clearRect(0, 0, this.width, this.height);

      // Subtle cyber horizon lines in background
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      this.ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < this.width; x += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
      }
      for (let y = 0; y < this.height; y += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Render connecting proximity lines
      const maxDist = 95;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * 0.14;
            this.ctx.strokeStyle = `rgba(147, 197, 253, ${lineAlpha})`;
            this.ctx.lineWidth = 0.6;
            this.ctx.beginPath();
            this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
            this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
            this.ctx.stroke();
          }
        }
      }

      // Update and draw particles
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        // Pulsing opacity
        p.pulse += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.pulse) * 0.2;

        // Mouse interaction
        if (this.mouse.x !== null && this.mouse.y !== null) {
          const dx = this.mouse.x - p.x;
          const dy = this.mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.mouse.radius) {
            const force = (this.mouse.radius - dist) / this.mouse.radius;
            p.x -= (dx / dist) * force * 1.6;
            p.y -= (dy / dist) * force * 1.6;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;

        // Draw particle
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0.05, Math.min(1, currentAlpha));
        this.ctx.fillStyle = p.color;
        this.ctx.shadowBlur = p.radius > 1.2 ? 6 : 0;
        this.ctx.shadowColor = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // Render floating micro-telemetry tags
      this.ctx.save();
      this.ctx.font = '10px "Space Mono", monospace';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      this.floatingTags.forEach(tag => {
        tag.x += tag.vx * 0.0008;
        tag.y += tag.vy * 0.0008;
        if (tag.x < 0.05 || tag.x > 0.95) tag.vx *= -1;
        if (tag.y < 0.1 || tag.y > 0.9) tag.vy *= -1;

        const px = tag.x * this.width;
        const py = tag.y * this.height;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        this.ctx.lineWidth = 1;

        const textWidth = this.ctx.measureText(tag.label).width;
        const padX = 8;
        const padY = 4;

        this.ctx.fillRect(px - padX, py - 9, textWidth + padX * 2, 18);
        this.ctx.strokeRect(px - padX, py - 9, textWidth + padX * 2, 18);

        this.ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
        this.ctx.fillText(tag.label, px, py);
      });
      this.ctx.restore();

      this.animationFrame = requestAnimationFrame(() => this.animate());
    }
  }

  window.LandingParticleCanvas = LandingParticleCanvas;

  window.addEventListener('DOMContentLoaded', () => {
    new LandingParticleCanvas();

    // Wire up landing button events
    const copilotBtn = document.getElementById('landing-open-copilot');
    if (copilotBtn) {
      copilotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const toggle = document.getElementById('btn-copilot-toggle');
        if (toggle) toggle.click();
      });
    }

    const snsBtn = document.getElementById('landing-btn-sns');
    if (snsBtn) {
      snsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const headerSns = document.getElementById('btn-sns-agent-status');
        if (headerSns) headerSns.click();
      });
    }

    const simBtn = document.getElementById('btn-hero-simulate');
    if (simBtn) {
      simBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById('scenario-simulator');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        } else {
          const dash = document.getElementById('dashboard-view');
          if (dash) dash.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    const simBtn2 = document.getElementById('btn-landing-simulator');
    if (simBtn2) {
      simBtn2.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById('scenario-simulator');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        } else {
          const dash = document.getElementById('dashboard-view');
          if (dash) dash.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    const footerAgentLink = document.getElementById('landing-footer-agent-link');
    if (footerAgentLink) {
      footerAgentLink.addEventListener('click', (e) => {
        e.preventDefault();
        const headerSns = document.getElementById('btn-sns-agent-status');
        if (headerSns) headerSns.click();
      });
    }

    const footerPrivacyLink = document.getElementById('landing-footer-privacy');
    if (footerPrivacyLink) {
      footerPrivacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Pallets is SOC-2 Type II compliant with end-to-end telemetry encryption and ISO-27001 dark-store audit logs.');
      });
    }

    const scrollLandingBtn = document.getElementById('btn-scroll-landing');
    if (scrollLandingBtn) {
      scrollLandingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const landing = document.getElementById('landing-view');
        if (landing) landing.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const newsForm = document.getElementById('landing-newsletter-form');
    if (newsForm) {
      newsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('newsletter-email');
        const email = emailInput ? emailInput.value.trim() : '';
        if (email) {
          if (window.soundEngine) window.soundEngine.poApproved();
          alert(`Thank you! Autonomous supply chain telemetry will be dispatched to ${email}.`);
          newsForm.reset();
        }
      });
    }
  });
})();
