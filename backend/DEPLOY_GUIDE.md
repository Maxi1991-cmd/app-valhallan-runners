# StrideX Backend - Deploy su Railway + MongoDB Atlas
# Guida passo passo

---

## PARTE 1: Creare il Database su MongoDB Atlas (gratuito)

### Step 1 - Crea un account
1. Vai su https://www.mongodb.com/cloud/atlas/register
2. Registrati con Google o email
3. Scegli il piano **FREE** (M0 Sandbox, 512MB)

### Step 2 - Crea un Cluster
1. Dopo la registrazione, clicca **"Build a Database"**
2. Scegli **M0 FREE** 
3. Provider: **AWS**
4. Region: scegli **eu-west-1 (Ireland)** (piu vicino all'Italia)
5. Cluster Name: **stridex-cluster**
6. Clicca **"Create Deployment"**

### Step 3 - Crea un utente del database
1. Nella schermata "Security Quickstart":
   - Username: **stridex_admin**
   - Password: scegli una password sicura (es: `StrideX_DB_2026!`)
   - **SALVA QUESTA PASSWORD**, ti servira dopo!
2. Clicca **"Create User"**

### Step 4 - Consenti accesso da ovunque
1. Nella sezione "Where would you like to connect from?"
2. Clicca **"Add My Current IP Address"**
3. POI clicca **"Add Entry"** e scrivi: `0.0.0.0/0` 
   (questo permette a Railway di connettersi)
4. Clicca **"Finish and Close"**

### Step 5 - Ottieni la stringa di connessione
1. Nella dashboard del cluster, clicca **"Connect"**
2. Scegli **"Drivers"**
3. Copia la stringa di connessione, sara tipo:
   ```
   mongodb+srv://stridex_admin:<password>@stridex-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. **Sostituisci `<password>`** con la password creata nello Step 3
5. **SALVA QUESTA STRINGA**, ti servira per Railway!

---

## PARTE 2: Deploy del Backend su Railway (gratuito)

### Step 1 - Crea un account Railway
1. Vai su https://railway.app
2. Clicca **"Login"** -> accedi con **GitHub**
3. Se non hai GitHub, crealo su https://github.com/join

### Step 2 - Prepara il codice su GitHub
1. Crea un nuovo repository su GitHub: https://github.com/new
   - Nome: **stridex-backend**
   - Visibilita: **Private**
   - Clicca **"Create repository"**

2. **Sul tuo computer** (o da Emergent "Save to GitHub"):
   - Devi pushare SOLO la cartella `backend/` nel repository
   - I file necessari sono:
     - `server.py` (il backend)
     - `requirements.txt` (le dipendenze - usa il file requirements-railway.txt rinominato)
     - `Procfile` (il comando di avvio)
     - `railway.toml` (configurazione Railway)

3. **IMPORTANTE**: NON pushare il file `.env`! Le variabili le mettiamo su Railway.

### Step 3 - Modifica server.py per Railway
Prima di pushare, devi rimuovere UNA riga da server.py:

**Rimuovi questa riga** (riga 23):
```python
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
```
Questa libreria e privata di Emergent e non serve perche Stripe e gia importato direttamente.

### Step 4 - Crea il progetto su Railway
1. Vai su https://railway.app/dashboard
2. Clicca **"New Project"**
3. Scegli **"Deploy from GitHub repo"**
4. Seleziona il repo **stridex-backend**
5. Railway iniziera il deploy automaticamente

### Step 5 - Configura le variabili d'ambiente
1. Clicca sul servizio appena creato
2. Vai nella tab **"Variables"**
3. Aggiungi queste variabili (clicca "New Variable" per ognuna):

| Variabile | Valore |
|-----------|--------|
| `MONGO_URL` | `mongodb+srv://stridex_admin:TUA_PASSWORD@stridex-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | `stridex_production` |
| `JWT_SECRET` | `stridex-jwt-secret-production-2026` |
| `STRIPE_SECRET_KEY` | `sk_test_51T92wu2MA3CDPbChoKLwbR16rRN5Sg9gQ8eoZu4RjI2IPX0dV5z6wkr0gt2kwjVChA3JYgW9u72ImXpGjbvVWPAq00n5T0EFNc` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_51T92wu2MA3CDPbChurkd3xsZzOAhY2lW36bYMQWLxu7LaPeXgYNiZ3846Bdq3cRaBVvuIlaI0qAcPIAdiUREFXQZ0021TwFkId` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_N1o8J6nIdHhaEy73HvpGCjVOd7IC6aCj` |
| `PORT` | `8000` |

4. Clicca **"Deploy"** per applicare le variabili

### Step 6 - Genera un dominio pubblico
1. Vai nella tab **"Settings"** del servizio
2. Nella sezione **"Networking"** -> **"Public Networking"**
3. Clicca **"Generate Domain"**
4. Railway ti dara un URL tipo: `stridex-backend-production.up.railway.app`
5. **SALVA QUESTO URL!**

### Step 7 - Verifica che funziona
Apri nel browser:
```
https://stridex-backend-production.up.railway.app/api/
```
Devi vedere: `{"message":"StrideX API","status":"running"}`

---

## PARTE 3: Collegare l'App al nuovo Backend

Dopo che Railway funziona, devi:

1. **Aggiornare `api.ts`** nel frontend:
   Cambia l'URL in `/app/frontend/src/services/api.ts`:
   ```typescript
   const BASE_URL = 'https://TUO-URL-RAILWAY.up.railway.app';
   ```

2. **Rifare il build AAB** con il nuovo URL
3. **Caricare il nuovo AAB** su Google Play

---

## PARTE 4: Migrare i dati esistenti (opzionale)

Se vuoi portare i tuoi atleti e dati esistenti nel nuovo database:

1. **Esporta** dal database attuale (lo facciamo da Emergent):
   ```bash
   mongodump --db test_database --out /tmp/stridex_backup
   ```

2. **Importa** su MongoDB Atlas:
   ```bash
   mongorestore --uri "mongodb+srv://stridex_admin:PASSWORD@stridex-cluster.xxxxx.mongodb.net" --db stridex_production /tmp/stridex_backup/test_database
   ```

---

## Riepilogo costi
- **MongoDB Atlas M0**: GRATIS (512MB, piu che sufficiente)
- **Railway Free Tier**: $5 di credito/mese (il backend ne usa circa $2-3)
- **Totale**: GRATIS per i primi mesi, poi ~$5/mese se superi il free tier

## Supporto
- Railway Dashboard: https://railway.app/dashboard
- MongoDB Atlas: https://cloud.mongodb.com
- Logs Railway: nel dashboard, clicca sul servizio -> tab "Deployments" -> "View Logs"
