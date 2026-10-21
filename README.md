# Farm2Homez

An online marketplace connecting farmers with customers. Sellers (farmers) list produce such as
fruit, vegetables, spices and honey, and customers browse, add to cart and check out. It has a
React/Vite frontend and a Django REST backend, and it is deployed on **AWS** with one command (see
[Running it on AWS](#running-it-on-aws)).

## Contents

- [How the website works](#how-the-website-works)
- [Using the admin panel](#using-the-admin-panel)
- [AWS services used](#aws-services-used)
- [Running it on AWS](#running-it-on-aws)
- [Running it locally](#running-it-locally)
- [API endpoints](#api-endpoints)

## How the website works

### Who uses it

| Role | What they can do | Demo login |
|---|---|---|
| Customer | Browse products, use the cart, check out | `customer@farm2homez.com` / `Customer@12345` |
| Seller (farmer) | Add and manage their own products from the dashboard | `seller@farm2homez.com` / `Seller@12345` |
| Admin | Manage users, products, orders and messages in the admin panel | `admin@farm2homez.com` / `Admin@12345` |

The demo accounts are created automatically on every AWS deploy. Change their passwords if the
site is ever shared publicly.

### Pages

| Address | Page |
|---|---|
| `/` | Home: categories, best sellers, new arrivals, contact form |
| `/products` | All products, with search and category filters |
| `/product/<id>` | One product, with "add to cart" |
| `/cart` | Shopping cart |
| `/checkout` | Checkout form |
| `/login` | Log in (also the person icon in the top bar) |
| `/dashboard` | After login. Sellers get the "Add product" form and their product list |
| `/admin/` | Django admin panel (staff only) |
| `/api/docs/` | Interactive API documentation (Swagger) |

### What is stored where

| Feature | Stored in |
|---|---|
| Login, accounts, passwords | **AWS RDS database** (through the API) |
| Contact form messages | **AWS RDS database** (through the API) |
| Product catalogue shown on the site | Built into the frontend code (`frontend/src/constants/site.js`) |
| Cart, checkout, products added by a seller | The visitor's browser only (`localStorage`) |

The backend already has complete APIs and database tables for products, carts, orders and reviews
(`/api/products/`, `/api/cart/`, `/api/orders/`, `/api/reviews/`). The frontend does not call them
yet, so those features don't reach the database.

## Using the admin panel

The admin panel is Django's built-in back office. It reads and writes the RDS database directly.

1. Open `https://<your-site>.cloudfront.net/admin/`.
2. Log in with `admin@farm2homez.com` / `Admin@12345`. Only accounts with **Staff status** can log in here.
3. The home screen lists every table, grouped by app. Click a name to see its records.

| Section | Table | What you do there |
|---|---|---|
| Accounts | **Users** | Every customer, seller and admin. Filter by role, search by email or farm name. Open a user to edit their details, tick **Seller verified** to approve a farmer, set **Email verified**, or give **Staff status** (admin access). |
| Products | **Products** | All listings stored in the database. Filter by category, organic, approved or flagged. Tick **Approved** / **Active** to publish or hide a product. Products the classifier couldn't categorise show **Flagged for admin review**. |
| Orders | **Orders** | Customer orders, with their items listed underneath. Change the **Status** as the order progresses. |
| Cart | **Cart items**, **Wishlist items** | What customers have saved through the API. |
| Reviews | **Reviews** | Product ratings and comments. Delete inappropriate ones. |
| Contacts | **Contact submissions** | Messages from the contact form on the home page. |
| Communications | **Email logs**, **WhatsApp logs** | Record of emails and WhatsApp messages the system sent, and whether they succeeded. |
| Token Blacklist | Outstanding / Blacklisted tokens | Login sessions. Blacklisting a token logs that session out. |

**Everyday actions**

- **Add a record:** the **+ Add** button next to a table, or **Add …** at the top right of its list.
- **Edit:** click a record, change the fields, then **Save**.
- **Delete:** tick records in a list, choose **Delete selected …** in the **Action** dropdown, click **Go**, then confirm.
- **Search and filter:** the search box above each list, and the **Filter** panel on the right.
- **Approve a new farmer:** Users → filter **Role: seller** → open the user → tick **Seller verified** → Save.
- **Reset a password:** Users → open the user → the **this form** link under the Password field.

**Demo of the cloud working end to end:** send a message with the contact form on the home page,
then open Admin → **Contact submissions**. The message was saved by the EC2 server into RDS and is
read back from there.

## AWS services used

Everything is defined in [`infra/farm2homez.yaml`](infra/farm2homez.yaml). How a request flows:

```
Browser ──HTTPS──► CloudFront ─┬─ /*            → S3 (website files)
                               ├─ /media/*      → S3 (product images)
                               └─ /api/*, /admin/*, /static/* → Load Balancer → EC2 (Django) → RDS (PostgreSQL)
```

To find any service, type its name in the search bar at the top of the AWS console.

### 1. AWS CloudFormation: builds everything
- **What it is:** infrastructure as code. You describe the resources in a template file and CloudFormation creates, updates or deletes them in the right order.
- **How we use it:** `farm2homez.yaml` defines all ~45 resources below. `deploy.sh` hands it to CloudFormation, so the whole system is rebuilt identically each lab session.
- **Where to look:** CloudFormation → Stacks → **farm2homez**. **Events** shows build progress, **Resources** lists everything with links, **Outputs** has the website URL.

### 2. Amazon VPC: the private network
- **What it is:** an isolated network in AWS that you control.
- **How we use it:** `10.20.0.0/16` across 2 Availability Zones (separate data centres), with 2 **public subnets** for the load balancer and servers and 2 **private subnets** for the database. The private ones have no internet route at all. There's an Internet Gateway for the public side, route tables, and a free **S3 gateway endpoint** so server-to-S3 traffic stays inside AWS. There's no NAT gateway, which saves about $32 a month.
- **Where to look:** VPC → Your VPCs → **farm2homez-vpc**; also Subnets, Route tables, Endpoints.

### 3. Security Groups: the firewalls
- **What it is:** a virtual firewall attached to each resource, allowing only listed traffic in.
- **How we use it:** three groups chained together, so each layer is only reachable from the one in front of it:

  | Group | Allows in | From |
  |---|---|---|
  | `farm2homez-alb-sg` | port 80 | CloudFront's IP ranges only (AWS managed prefix list) |
  | `farm2homez-app-sg` | port 8000 | the load balancer only (no SSH) |
  | `farm2homez-db-sg` | port 5432 | the app servers only |
- **Where to look:** EC2 → Security Groups (or VPC → Security groups) → open one → **Inbound rules**.

### 4. Amazon S3: file storage
- **What it is:** object storage for files of any size.
- **How we use it:** three buckets:
  - `farm2homez-sitebucket-…`: the built React website.
  - `farm2homez-mediabucket-…`: product photos uploaded by sellers (via `services/s3_service.py`).
  - `farm2homez-artifacts-<account>`: the packaged backend code that servers download at boot, plus the server setup log.

  The site and media buckets are **private and encrypted**. Only CloudFront may read them (Origin Access Control), and plain-HTTP access is denied.
- **Where to look:** S3 → Buckets → click one to browse its files.

### 5. Amazon CloudFront: the front door (CDN)
- **What it is:** a content delivery network with edge locations worldwide that serve and cache content close to users.
- **How we use it:** provides the public `https://….cloudfront.net` address with free HTTPS, so no domain or certificate is needed. Its **behaviors** route `/api/*`, `/admin/*` and `/static/*` to the load balancer (not cached) and everything else to S3 (cached). Having one address for everything avoids CORS and mixed-content problems. A small **CloudFront Function** rewrites React page URLs like `/cart` to `index.html` so refreshing works.
- **Where to look:** CloudFront → Distributions → the one commented **Farm2Homez** → **Behaviors** and **Origins** tabs; CloudFront → Functions.

### 6. Elastic Load Balancing (Application Load Balancer)
- **What it is:** spreads incoming requests across healthy servers.
- **How we use it:** `farm2homez-alb` receives API traffic from CloudFront and forwards it to the **target group** `farm2homez-api` (port 8000). It calls `/api/health/` every 15 seconds and stops sending traffic to any server that fails.
- **Where to look:** EC2 → Load Balancers → **farm2homez-alb**; EC2 → Target Groups → **farm2homez-api** → **Targets** (should say *healthy*).

### 7. Amazon EC2: the servers
- **What it is:** virtual machines.
- **How we use it:** Amazon Linux 2023 on `t3.small`. A **launch template** contains the setup script (user data), which installs Python, downloads the backend from S3, reads secrets, migrates the database, loads demo data and starts Django with gunicorn as a systemd service. Instances use **IMDSv2** and gp2 disks.
- **Where to look:** EC2 → Instances → **farm2homez-app**. To open a terminal on it without SSH: select it → **Connect** → **Session Manager**.

### 8. Amazon EC2 Auto Scaling: keeps servers running
- **What it is:** automatically adds, removes and replaces EC2 instances.
- **How we use it:** keeps 1–2 servers across both Availability Zones. A target-tracking policy adds a server above 60% average CPU. Servers failing load balancer health checks are replaced automatically, and new code rolls out one server at a time with no downtime.
- **Where to look:** EC2 → Auto Scaling Groups → **farm2homez-app-farm2homez** → **Activity** tab.

### 9. Amazon RDS for PostgreSQL: the database
- **What it is:** a managed relational database. AWS handles installation, backups, patching and storage.
- **How we use it:** `farm2homez-db`, PostgreSQL 17 on `db.t3.micro` in the private subnets: not publicly accessible, encrypted at rest, with 1-day automated backups. It stores users, products, carts, orders, reviews and contact messages, plus the cache (OTP codes, rate limits), so every server shares it.
- **Where to look:** RDS → Databases → **farm2homez-db** → **Monitoring** and **Connectivity & security** tabs.

### 10. AWS Systems Manager: secrets and remote access
- **What it is:** a toolbox for managing servers. We use two parts of it.
- **Parameter Store:** holds the Django secret key, JWT secret, database password and optional SMTP login under `/farm2homez/`, encrypted as SecureString. Servers read them at boot, so no secrets are in the code or template.
- **Session Manager:** browser-based terminal access to the servers with no SSH port open.
- **Where to look:** Systems Manager → **Parameter Store**; Systems Manager → **Session Manager** (or EC2 → Connect).

### 11. AWS IAM: permissions
- **What it is:** Identity and Access Management controls who and what can access each AWS resource.
- **How we use it:** the sandbox doesn't allow creating roles, so the servers use the pre-made **LabInstanceProfile / LabRole**. It lets them read S3, read Parameter Store, send logs and metrics to CloudWatch, and signal CloudFormation, all without storing access keys.
- **Where to look:** IAM → Roles → **LabRole** (read-only in the sandbox).

### 12. Amazon CloudWatch: monitoring
- **What it is:** AWS's logging, metrics and alerting service.
- **How we use it:**
  - **Logs:** the CloudWatch agent on each server ships three log streams to `/farm2homez/farm2homez/app`: `…/bootstrap` (server setup), `…/app` (Django errors; OTP codes when email isn't configured) and `…/access` (every API request). Logs are kept for 7 days.
  - **Metrics:** built-in ones from the load balancer, EC2, RDS and CloudFront, plus server memory and disk usage from the agent.
  - **Dashboard** `farm2homez-farm2homez`: requests, errors, response time, CPU, memory, healthy hosts, database load, CloudFront traffic and recent errors.
  - **Alarms:** API 5xx errors, an unhealthy server, high server CPU, high database CPU.
- **Where to look:** CloudWatch → Log groups / Dashboards / Alarms. From CloudShell: `aws logs tail /farm2homez/farm2homez/app --since 10m`.

### 13. Amazon SNS: alert notifications
- **What it is:** Simple Notification Service, a publish/subscribe messaging service.
- **How we use it:** the CloudWatch alarms publish to the `farm2homez-alerts-…` topic. Deploy with `ALERT_EMAIL=you@example.com` and it emails you (confirm the subscription email first).
- **Where to look:** SNS → Topics.

### 14. AWS CloudShell: where you deploy from
- **What it is:** a browser terminal inside the AWS console, already logged in to your account.
- **How we use it:** runs `infra/deploy.sh`, which uses Git, the AWS CLI and Node.js to package the backend, deploy the stack and build and upload the website.
- **Where to look:** the `>_` icon in the console's top bar.

### Cost

About **$0.08 per hour** of Academy credits: EC2 ≈ $0.021, RDS ≈ $0.020, load balancer ≈ $0.023,
public IPs ≈ $0.015, and the rest within the free tier. The sandbox deletes everything at the end
of each session, so nothing runs overnight.

## Running it on AWS

Each AWS Academy sandbox session:

1. Click **Start Lab**, wait for the green dot, then click **AWS**. Check the region is **N. Virginia (us-east-1)**.
2. Open **CloudShell** (the `>_` icon) and run:
   ```bash
   git clone -b aws-deploy https://github.com/povellphilip/Farm2Homez.git
   bash Farm2Homez/infra/deploy.sh
   ```
3. Wait about 20 minutes. The script ends with **"Farm2Homez is live!"** and the website link.

Re-running the script is safe: it updates what exists, retries a failed deploy from where it
stopped, and prints the server log if something fails. Full details, troubleshooting and a
report checklist are in [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md).

## Running it locally

Frontend (http://localhost:5173):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Backend (http://localhost:8000/api). It uses SQLite, a database cache and inline email when no
Postgres or Redis is configured:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createcachetable
python manage.py seed_database
python manage.py seed_data
python manage.py runserver
```

## API endpoints

Full interactive list at `/api/docs/`. The main ones:

- `POST /api/auth/customer/register/`, `POST /api/auth/seller/register/`, `POST /api/auth/verify-otp/`
- `POST /api/auth/login/`, `POST /api/auth/refresh/`, `POST /api/auth/logout/`, `GET /api/auth/profile/`
- `GET /api/products/` and the cart, orders and reviews endpoints under `/api/cart/`, `/api/orders/`, `/api/reviews/`
- `POST /api/contact/`, `GET /api/contact/list/`
- `POST /api/whatsapp/send/`
- `GET /api/health/` (load balancer health check)
