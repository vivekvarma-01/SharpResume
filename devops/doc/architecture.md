# **System Architecture – Creorez (AI Resume Builder)**

## ✅ Overview

Creorez is a full-stack AI-powered resume builder consisting of:

- **Frontend** — Next.js (App Router) deployed on **Vercel**
- **Backend** — Node.js microservice deployed on **AWS EC2**
- **Core Engine** — LaTeX → PDF resume generation via Tectonic
- **Container** — Dockerized backend for portability and reproducibility
- **CI/CD** — GitHub Actions for automated builds and deployments
- **Monitoring** — CloudWatch (optional, re-enable in production)

---

## ✅ High-Level Architecture Diagram
```
                 ┌────────────────────────────────┐
                 │            User Browser         │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                     (Vercel Frontend - Next.js)
                 ┌────────────────────────────────┐
                 │  Resume Builder UI              │
                 │  Fill Form → Generate Resume    │
                 │  ATS Score Page                 │
                 │  Enhance Resume                 │
                 └───────────────┬────────────────┘
                                 │  HTTP API Call
                                 ▼
                 ┌────────────────────────────────┐
                 │   AWS EC2 (Ubuntu 24.04)        │
                 │   Region: ap-northeast-1        │
                 │  ┌──────────────────────────┐  │
                 │  │   Nginx (Port 80)         │  │
                 │  │   Reverse Proxy           │  │
                 │  └────────────┬─────────────┘  │
                 │               ↓                 │
                 │  ┌──────────────────────────┐  │
                 │  │   Docker Container        │  │
                 │  │   Node.js 22 + Tectonic   │  │
                 │  │   Port 3001               │  │
                 │  └──────────────────────────┘  │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                         PDF Response
                 ┌────────────────────────────────┐
                 │   Vercel Frontend (Next.js)     │
                 │   Renders PDF to user           │
                 └────────────────────────────────┘
```

---

## ✅ CI/CD Pipeline Architecture
```
Developer pushes to main (resume-backend/)
            ↓
    GitHub Actions
  ┌───────────────────────────┐
  │  1. Checkout code         │
  │  2. Login to DockerHub    │
  │  3. Build Docker image    │
  │  4. Push to DockerHub     │
  └──────────┬────────────────┘
             ↓
      SSH into EC2
  ┌───────────────────────────┐
  │  5. Pull latest image     │
  │  6. Remove old container  │
  │  7. Run new container     │
  │  8. Verify docker ps      │
  └───────────────────────────┘
             ↓
    Zero downtime deploy ✅
```

---

## ✅ Components Breakdown

### **1. Frontend (Vercel + Next.js)**
- Interactive resume builder UI
- Form inputs sent to backend for PDF generation
- Receives PDF response and renders to user
- Auto-deploys from GitHub on every push

### **2. Backend (Node.js on AWS EC2)**

| Component | Purpose |
|-----------|---------|
| **Node.js 22** | Serves API endpoints |
| **Express** | Handles `/generate` route |
| **Tectonic** | Lightweight LaTeX → PDF engine (70-100MB vs TeXLive 3GB+) |
| **Docker** | Containerizes entire backend — portable and reproducible |
| **Nginx** | Reverse proxy, routes port 80 → Docker container port 3001 |
| **Elastic IP** | Permanent static IP — survives EC2 reboots |

### **3. CI/CD (GitHub Actions)**

| Step | Action |
|------|--------|
| Trigger | Push to `main` on `resume-backend/**` |
| Build | Docker image built on GitHub runner |
| Push | Image pushed to DockerHub |
| Deploy | SSH into EC2 → pull image → restart container |
| Manual | `workflow_dispatch` for manual triggers |

### **4. DockerHub Backup**

| Item | Value |
|------|-------|
| Image | `sriharshareddy6464/pdf-server:latest` |
| Purpose | Backup — restore entire backend in under 10 minutes |

### **5. Monitoring (CloudWatch — Optional)**

> 💡 Disabled in alpha stage to reduce costs. Re-enable in production.

| Metric | Interval | Alarm Threshold |
|--------|----------|-----------------|
| CPU Utilization | 1 min (default) | > 60% |
| Memory Used % | 1 hour | > 75% |
| Disk Used % | 1 hour | > 60% |

---

## ✅ API Communication
```
Frontend (Vercel)
    → POST /generate { "code": "<latex>" }
    → Backend (EC2)
    → Tectonic compiles LaTeX → PDF
    → Returns PDF binary
    → Frontend renders to user
```

---

## ✅ Deployment Architecture

### **Frontend**
- Hosted on **Vercel**
- Auto-deploys from GitHub on push
- Points to EC2 Elastic IP for backend calls

### **Backend**
- Hosted on **AWS EC2** (Ubuntu 24.04, t3.micro, 32GB gp3)
- Region: Asia Pacific Tokyo (ap-northeast-1)
- Elastic IP for permanent addressing
- Dockerized — `--restart always` handles crashes and reboots
- Nginx reverse proxy on port 80
- GitHub Actions handles all deployments automatically

---

## ✅ DevOps Workflow

1. Launch EC2 → assign Elastic IP
2. Install Docker + Node.js + Tectonic dependencies
3. Build Docker image from Dockerfile
4. Run container with `--restart always`
5. Configure Nginx reverse proxy
6. Push image to DockerHub as backup
7. Set up GitHub Actions CI/CD pipeline
8. Open ports 22 / 80 / 443 / 3001 in Security Group
9. Test via curl and browser
10. Share endpoint with frontend team
11. All future deployments → push to main → auto deploy ✅

---

## ✅ Security Considerations

- SSH limited to authorised IPs only
- Ports open: **22 / 80 / 443 / 3001**
- Docker `--restart always` — auto recovery on crash or reboot
- Nginx prevents direct Node exposure
- No credentials or secrets committed to Git
- Real IPs and keys never in version control
- GitHub Secrets used for all sensitive pipeline values
- IAM Role scoped to CloudWatch only (`CloudWatchAgentServerPolicy`)

---

## ✅ Disaster Recovery

If EC2 is lost or terminated:
```bash
# 1. Launch new EC2
# 2. Install Docker
sudo apt install -y docker.io
sudo systemctl start docker

# 3. Pull image from DockerHub
docker pull sriharshareddy6464/pdf-server:latest

# 4. Run container
docker run -d --name pdf-server --restart always -p 3001:3001 sriharshareddy6464/pdf-server:latest

# 5. Setup Nginx
# Back online in under 10 minutes ✅

# 6. Update EC2_HOST secret in GitHub
# CI/CD pipeline resumes automatically ✅
```

---

## 🔜 Upcoming Architecture (Phase 2)
```
Current (Phase 1)          Upcoming (Phase 2)
─────────────────          ──────────────────
Single EC2           →     EKS (Kubernetes)
Docker run           →     Helm Charts + Pods
Manual infra         →     Terraform (IaC)
Nginx                →     Ingress Controller
CloudWatch           →     Prometheus + Grafana
HTTP only            →     HTTPS (SSL via Let's Encrypt)
GitHub Actions       →     Full GitOps pipeline
```

---

## ✅ Architecture Files

- `deployment.md` — full deployment steps
- `aws-setup.md` — AWS configuration guide
- `server-setup.md` — server operations guide
- `docker-setup.md` — Docker and container guide
- `configs/nginx.conf` — Nginx configuration
- `.github/workflows/deploy.yml` — CI/CD pipeline

---

## ✅ Author

**Adapala Sriharsha Reddy — DevOps & Cloud Engineer**

Responsibilities:
- Designed and provisioned AWS EC2 architecture
- Containerized backend using Docker
- Configured Nginx reverse proxy
- Implemented GitHub Actions CI/CD pipeline
- Implemented DockerHub backup strategy
- Assigned Elastic IP for permanent availability
- Set up CloudWatch monitoring and alerting
- Connected backend with Vercel frontend
- Entire Phase 1 setup completed from mobile (Android + Termius)