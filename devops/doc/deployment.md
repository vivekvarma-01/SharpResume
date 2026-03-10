# **AWS Deployment Steps – Creorez Backend (Node.js + Docker + Nginx + GitHub Actions)**

This document provides the full sequence of actions used to deploy the Creorez backend on an AWS EC2 instance. It includes instance setup, environment configuration, Docker containerization, reverse proxy configuration, CI/CD pipeline, and monitoring setup.

---

## ✅ **1. Launch EC2 Instance**

**Configuration used:**

| Setting | Value |
|---------|-------|
| AMI | Ubuntu 24.04 LTS |
| Instance Type | t3.micro |
| Storage | 32GB gp3 |
| Region | Asia Pacific (Tokyo) ap-northeast-1 |
| Inbound Rules | 22 (SSH), 80 (HTTP), 443 (HTTPS), 3001 (Custom TCP) |

**Steps:**
1. Go to AWS → EC2 → Launch Instance
2. Name the instance (e.g. `doityourez-prod`)
3. Select `Ubuntu 24.04 LTS`
4. Choose `t3.micro`
5. Add storage: 32GB gp3
6. Security Groups — allow:
   - `22` TCP (SSH)
   - `80` TCP (HTTP)
   - `443` TCP (HTTPS)
   - `3001` TCP (Custom — backend port)

---

## ✅ **2. Allocate Elastic IP (Permanent IP)**

> ⚠️ Without Elastic IP, your server IP changes every reboot.

1. Go to EC2 → Elastic IPs
2. Click **Allocate Elastic IP address** → Allocate
3. Select the new IP → Actions → **Associate Elastic IP**
4. Select your instance → Associate

> 💡 Note: Keep your Elastic IP private — never commit it to public repos.

---

## ✅ **3. Connect to Instance**

**Using terminal:**
```bash
ssh -i "your-key.pem" ubuntu@<YOUR-ELASTIC-IP>
```

**Using Termius (Android/iOS — recommended for mobile):**
- Host: `<YOUR-ELASTIC-IP>`
- Username: `ubuntu`
- Key: import your `.pem` file

---

## ✅ **4. Server Setup**

**Update system:**
```bash
sudo apt update && sudo apt upgrade -y
```

**Install Node.js 22:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Verify:**
```bash
node -v && npm -v
```

**Install Docker:**
```bash
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker
```

**Verify Docker:**
```bash
docker --version
docker ps
```

---

## ✅ **5. Setup Backend**

**Create project folder:**
```bash
mkdir ~/resume-backend && cd ~/resume-backend
npm init -y
npm install express cors
```

**Install Tectonic system dependencies:**
```bash
sudo apt install -y libgraphite2-3 libharfbuzz0b libfontconfig1 libssl-dev curl
```

**Install Tectonic:**
```bash
curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh
sudo mv tectonic /usr/local/bin/tectonic
sudo chmod +x /usr/local/bin/tectonic
tectonic --version
```

**Create server.js:**
```bash
nano server.js
```
```javascript
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ Node.js PDF Server Working");
});

app.post("/generate", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "No LaTeX content provided" });

    const fileName = `resume-${Date.now()}`;
    const texPath = path.join(os.tmpdir(), `${fileName}.tex`);
    const pdfPath = path.join(os.tmpdir(), `${fileName}.pdf`);

    try {
      fs.writeFileSync(texPath, code);
    } catch (err) {
      return res.status(500).json({ error: "Write failure" });
    }

    await new Promise((resolve, reject) => {
      const cmd = spawn("/usr/local/bin/tectonic", ["--outdir", "/tmp", texPath]);
      cmd.stdout.on("data", data => console.log(data.toString()));
      cmd.stderr.on("data", data => console.error(data.toString()));
      cmd.on("error", err => reject(err));
      cmd.on("close", exit => {
        if (exit === 0) resolve();
        else reject(new Error("Tectonic failed with exit code " + exit));
      });
    });

    let pdfBuffer;
    try {
      pdfBuffer = fs.readFileSync(pdfPath);
    } catch (err) {
      return res.status(500).json({ error: "PDF read error" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);

    try { fs.unlinkSync(texPath); } catch {}
    try { fs.unlinkSync(pdfPath); } catch {}

  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

process.on("uncaughtException", err => console.error("❌ UNCAUGHT:", err));
process.on("unhandledRejection", err => console.error("❌ UNHANDLED:", err));

app.listen(3001, "0.0.0.0", () => {
  console.log("✅ PDF Server running on port 3001");
});
```

---

## ✅ **6. Dockerize the Backend**

**Create Dockerfile:**
```bash
nano Dockerfile
```
```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    libgraphite2-3 \
    libharfbuzz0b \
    libfontconfig1 \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/tectonic \
    && chmod +x /usr/local/bin/tectonic

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

**Build image:**
```bash
docker build -t pdf-server .
```

**Run container:**
```bash
docker run -d \
  --name pdf-server \
  --restart always \
  -p 3001:3001 \
  pdf-server
```

**Verify:**
```bash
docker ps
```

---

## ✅ **7. Push to DockerHub (Backup)**
```bash
docker login
docker tag pdf-server sriharshareddy6464/pdf-server:latest
docker push sriharshareddy6464/pdf-server:latest
```

> ✅ Image backed up at: `sriharshareddy6464/pdf-server:latest`

**To restore from scratch:**
```bash
docker pull sriharshareddy6464/pdf-server:latest
docker run -d --name pdf-server --restart always -p 3001:3001 sriharshareddy6464/pdf-server:latest
```

---

## ✅ **8. Setup Nginx (Reverse Proxy)**
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Configure:**
```bash
sudo nano /etc/nginx/sites-available/default
```
```nginx
server {
    listen 80;
    server_name <YOUR-ELASTIC-IP>;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ **9. GitHub Actions CI/CD Pipeline**

Every push to `main` inside `resume-backend/` automatically builds, pushes, and deploys — zero manual intervention.

### **Pipeline Flow:**
```
Push to main (resume-backend/ changes)
    ↓
GitHub Actions triggered
    ↓
Checkout code
    ↓
Login to DockerHub
    ↓
Build Docker image
    ↓
Push to DockerHub
    ↓
SSH into EC2
    ↓
Pull new image → Remove old container → Run new container
    ↓
Zero manual intervention ✅
```

### **Workflow file location:**
```
.github/workflows/deploy.yml
```

### **Workflow file:**
```yaml
name: Deploy to EC2

on:
  push:
    branches:
      - main
    paths:
      - 'resume-backend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build Docker image
        run: |
          cd resume-backend
          docker build -t ${{ secrets.DOCKER_USERNAME }}/pdf-server:latest .

      - name: Push to DockerHub
        run: |
          docker push ${{ secrets.DOCKER_USERNAME }}/pdf-server:latest

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            docker pull sriharshareddy6464/pdf-server:latest
            docker rm -f pdf-server || true
            docker run -d \
              --name pdf-server \
              --restart always \
              -p 3001:3001 \
              sriharshareddy6464/pdf-server:latest
            docker ps
```

### **GitHub Secrets required:**

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | DockerHub username |
| `DOCKER_PASSWORD` | DockerHub password |
| `EC2_HOST` | Elastic IP address |
| `EC2_SSH_KEY` | Contents of `.pem` key file |

> ⚠️ Never commit secrets to Git. Always use GitHub Secrets.

---

## ✅ **10. CloudWatch Monitoring (Optional)**

> 💡 Disabled in alpha stage to reduce costs (~$10-15/month savings).
> Re-enable in production when needed.

### Install CloudWatch Agent:
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

### Create config file:
```bash
sudo tee /opt/aws/amazon-cloudwatch-agent/bin/config.json > /dev/null << 'EOF'
{
  "metrics": {
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    },
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 3600
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/"],
        "metrics_collection_interval": 3600
      }
    }
  }
}
EOF
```

### Attach IAM Role to EC2:
1. EC2 → Actions → Security → **Modify IAM Role**
2. Attach policy: `CloudWatchAgentServerPolicy`
3. Role name: `creorez-cloudwatch-role`

### Start Agent:
```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json \
  -s
```

### Re-enable when needed:
```bash
sudo systemctl enable amazon-cloudwatch-agent
sudo systemctl start amazon-cloudwatch-agent
```

### CloudWatch Alarms:

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| `creorez-cpu-alarm` | CPUUtilization | > 60% |
| `creorez-memory-alarm` | mem_used_percent | > 75% |
| `creorez-disk-alarm` | disk_used_percent | > 60% |

---

## ✅ **11. Cost Optimization**

| Service | Cost |
|---------|------|
| EC2 t3.micro | ~$7.50/month |
| Elastic IP (attached) | Free |
| gp3 Storage 32GB | ~$2.56/month |
| CloudWatch (disabled) | $0 |
| GitHub Actions | Free (public repo) |
| **Total** | **~$10/month** |

---

## ✅ **12. API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `http://<YOUR-ELASTIC-IP>/` | GET | Health check |
| `http://<YOUR-ELASTIC-IP>/generate` | POST | LaTeX → PDF |

**Request body:**
```json
{
  "code": "your latex code here"
}
```
Returns: PDF file directly.

---

## ✅ **13. Disaster Recovery**

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
```

---

## ✅ **14. Summary**

| Step | What | Why |
|------|------|-----|
| EC2 | Ubuntu 24.04 t3.micro 32GB | Cloud server |
| Elastic IP | Static IP | Never changes on reboot |
| Node.js 22 | Runtime | Backend engine |
| Tectonic | LaTeX engine | Lightweight PDF compiler |
| Docker | Containerization | Portable, reproducible |
| DockerHub | Image backup | Restore in 2 mins anywhere |
| Nginx | Reverse proxy | Clean URL on port 80 |
| GitHub Actions | CI/CD pipeline | Zero manual deployments |
| CloudWatch | Monitoring (optional) | Re-enable in production |

---

## 🔜 **Next Steps (Phase 2)**

- [ ] Domain name + SSL (Let's Encrypt)
- [ ] Docker Compose
- [ ] Terraform (IaC)
- [ ] EKS + Kubernetes
- [ ] Prometheus + Grafana
- [ ] Staging environment