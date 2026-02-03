from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from bson import ObjectId
import gpxpy
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'runcoach_db')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'runcoach-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="RunCoach Pro API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "coach"  # coach or athlete

class SubscriptionInfo(BaseModel):
    plan: str = "none"  # none, monthly, annual
    status: str = "inactive"  # active, inactive, expired
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    coach_id: Optional[str] = None  # For athletes, links to their coach
    subscription: Optional[SubscriptionInfo] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    coach_id: Optional[str] = None
    subscription: Optional[SubscriptionInfo] = None

class SubscriptionUpdate(BaseModel):
    plan: str  # monthly, annual
    status: str  # active, inactive

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class AthleteLoginRequest(BaseModel):
    email: EmailStr
    access_code: str

# Athlete Profile Models
class BiometricData(BaseModel):
    heart_rate_max: Optional[int] = None
    heart_rate_rest: Optional[int] = None
    vo2_max: Optional[float] = None
    lactate_threshold: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[int] = None
    custom_metrics: Optional[dict] = {}

class MedicalCertificate(BaseModel):
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    document_base64: Optional[str] = None

class PaymentRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: str  # Format: YYYY-MM
    amount: float
    paid: bool = False
    paid_date: Optional[str] = None
    due_date: str

class AthleteProfileBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    notes: Optional[str] = None

class AthleteProfileCreate(AthleteProfileBase):
    password: Optional[str] = None  # Optional password for athlete login

class AthleteProfile(AthleteProfileBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coach_id: str
    user_id: Optional[str] = None  # Linked user account if athlete has login
    access_code: Optional[str] = None  # Codice accesso per login atleta
    biometrics: BiometricData = Field(default_factory=BiometricData)
    medical_certificate: MedicalCertificate = Field(default_factory=MedicalCertificate)
    payments: List[PaymentRecord] = []
    connected_platforms: dict = {}  # Garmin, Polar, Suunto, Strava, Fitbit status
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AthleteProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    notes: Optional[str] = None
    biometrics: Optional[BiometricData] = None
    medical_certificate: Optional[MedicalCertificate] = None

# Training Models
class WorkoutSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day: str  # Day of the week or date
    date: Optional[str] = None  # Specific date YYYY-MM-DD for calendar
    title: str
    description: str
    workout_type: str  # easy, tempo, interval, long_run, recovery, etc.
    duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    target_pace: Optional[str] = None  # e.g., "5:30-6:00 min/km"
    heart_rate_zone: Optional[str] = None
    power_zone: Optional[str] = None
    notes: Optional[str] = None
    completed: bool = False
    completed_date: Optional[str] = None
    actual_data: Optional[dict] = None  # Actual performance data

class TrainingProgramBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: str
    goal: Optional[str] = None

class TrainingProgramCreate(TrainingProgramBase):
    athlete_id: str
    workouts: List[WorkoutSession] = []

class TrainingProgram(TrainingProgramBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coach_id: str
    athlete_id: str
    workouts: List[WorkoutSession] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TrainingProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None
    workouts: Optional[List[WorkoutSession]] = None

# Notification Models
class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str  # payment_due, certificate_expiry, message, reminder, workout_completed

class NotificationCreate(NotificationBase):
    recipient_id: str
    related_data: Optional[dict] = None  # Additional data like workout details

class Notification(NotificationBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: Optional[str] = None  # Made optional for legacy notifications
    recipient_id: str
    read: bool = False
    related_data: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Activity Data Models (for analytics)
class ActivityData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str
    activity_type: str
    duration_minutes: int
    distance_km: Optional[float] = None
    avg_pace: Optional[str] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    calories: Optional[int] = None
    elevation_gain: Optional[int] = None
    avg_power: Optional[int] = None
    source: str = "manual"  # manual, gpx, fit, garmin, polar, suunto, strava, fitbit
    raw_data: Optional[dict] = None
    gpx_points: Optional[List[dict]] = None  # GPS track points
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ActivityDataCreate(BaseModel):
    athlete_id: str
    date: str
    activity_type: str
    duration_minutes: int
    distance_km: Optional[float] = None
    avg_pace: Optional[str] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    calories: Optional[int] = None
    elevation_gain: Optional[int] = None
    avg_power: Optional[int] = None
    source: str = "manual"

# Workout Completion Model
class WorkoutCompletionData(BaseModel):
    duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    avg_pace: Optional[str] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    calories: Optional[int] = None
    notes: Optional[str] = None
    feeling: Optional[str] = None  # great, good, ok, tired, exhausted

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return user

# ==================== GPX/FIT PARSING HELPERS ====================

def parse_gpx_file(gpx_content: str) -> dict:
    """Parse GPX file and extract activity data"""
    try:
        gpx = gpxpy.parse(gpx_content)
        
        total_distance = 0
        total_time = 0
        elevation_gain = 0
        points = []
        heart_rates = []
        
        for track in gpx.tracks:
            for segment in track.segments:
                prev_point = None
                for point in segment.points:
                    points.append({
                        "lat": point.latitude,
                        "lon": point.longitude,
                        "ele": point.elevation,
                        "time": point.time.isoformat() if point.time else None
                    })
                    
                    if prev_point:
                        total_distance += point.distance_3d(prev_point) or point.distance_2d(prev_point) or 0
                        if point.elevation and prev_point.elevation:
                            ele_diff = point.elevation - prev_point.elevation
                            if ele_diff > 0:
                                elevation_gain += ele_diff
                    
                    # Extract heart rate from extensions if available
                    if point.extensions:
                        for ext in point.extensions:
                            hr_elem = ext.find('.//{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}hr')
                            if hr_elem is not None:
                                heart_rates.append(int(hr_elem.text))
                    
                    prev_point = point
        
        # Calculate duration
        if gpx.tracks and gpx.tracks[0].segments:
            seg = gpx.tracks[0].segments[0]
            if seg.points and len(seg.points) > 1:
                start_time = seg.points[0].time
                end_time = seg.points[-1].time
                if start_time and end_time:
                    total_time = (end_time - start_time).total_seconds() / 60
        
        # Calculate pace (min/km)
        distance_km = total_distance / 1000
        avg_pace = None
        if distance_km > 0 and total_time > 0:
            pace_min = total_time / distance_km
            pace_sec = (pace_min % 1) * 60
            avg_pace = f"{int(pace_min)}:{int(pace_sec):02d}"
        
        # Get activity date
        activity_date = None
        if gpx.tracks and gpx.tracks[0].segments and gpx.tracks[0].segments[0].points:
            first_point = gpx.tracks[0].segments[0].points[0]
            if first_point.time:
                activity_date = first_point.time.strftime("%Y-%m-%d")
        
        return {
            "distance_km": round(distance_km, 2),
            "duration_minutes": int(total_time),
            "elevation_gain": int(elevation_gain),
            "avg_pace": avg_pace,
            "avg_heart_rate": int(sum(heart_rates) / len(heart_rates)) if heart_rates else None,
            "max_heart_rate": max(heart_rates) if heart_rates else None,
            "date": activity_date or datetime.utcnow().strftime("%Y-%m-%d"),
            "gpx_points": points[:500]  # Limit points to reduce storage
        }
    except Exception as e:
        logger.error(f"Error parsing GPX: {e}")
        raise HTTPException(status_code=400, detail=f"Error parsing GPX file: {str(e)}")

def parse_fit_file(fit_content: bytes) -> dict:
    """Parse FIT file and extract activity data"""
    try:
        from fitparse import FitFile
        
        fitfile = FitFile(io.BytesIO(fit_content))
        
        total_distance = 0
        total_time = 0
        elevation_gain = 0
        heart_rates = []
        speeds = []
        activity_date = None
        
        for record in fitfile.get_messages('record'):
            for data in record:
                if data.name == 'heart_rate' and data.value:
                    heart_rates.append(data.value)
                elif data.name == 'distance' and data.value:
                    total_distance = data.value
                elif data.name == 'enhanced_speed' and data.value:
                    speeds.append(data.value)
                elif data.name == 'total_ascent' and data.value:
                    elevation_gain = data.value
        
        for record in fitfile.get_messages('session'):
            for data in record:
                if data.name == 'total_elapsed_time' and data.value:
                    total_time = data.value / 60  # Convert to minutes
                elif data.name == 'start_time' and data.value:
                    activity_date = data.value.strftime("%Y-%m-%d")
        
        distance_km = total_distance / 1000 if total_distance else 0
        
        # Calculate pace
        avg_pace = None
        if distance_km > 0 and total_time > 0:
            pace_min = total_time / distance_km
            pace_sec = (pace_min % 1) * 60
            avg_pace = f"{int(pace_min)}:{int(pace_sec):02d}"
        
        return {
            "distance_km": round(distance_km, 2),
            "duration_minutes": int(total_time),
            "elevation_gain": int(elevation_gain) if elevation_gain else None,
            "avg_pace": avg_pace,
            "avg_heart_rate": int(sum(heart_rates) / len(heart_rates)) if heart_rates else None,
            "max_heart_rate": max(heart_rates) if heart_rates else None,
            "date": activity_date or datetime.utcnow().strftime("%Y-%m-%d"),
        }
    except Exception as e:
        logger.error(f"Error parsing FIT: {e}")
        raise HTTPException(status_code=400, detail=f"Error parsing FIT file: {str(e)}")

# ==================== AUTH ROUTES ====================

# Email del proprietario dell'app - accesso gratuito illimitato
OWNER_EMAILS = ["maxi1991@hotmail.it"]  # Proprietario: accesso lifetime gratuito

# Helper function per verificare se l'abbonamento è attivo
def check_subscription_active(user: dict) -> bool:
    """Verifica se l'abbonamento del coach è attivo"""
    if user.get("role") != "coach":
        return True  # Gli atleti non hanno bisogno di abbonamento
    
    # Il proprietario ha sempre accesso illimitato
    if user.get("email") in OWNER_EMAILS or user.get("is_owner") == True:
        return True
    
    subscription = user.get("subscription")
    if not subscription:
        return False
    
    if subscription.get("status") != "active":
        return False
    
    # Verifica data scadenza
    end_date_str = subscription.get("end_date")
    if end_date_str:
        try:
            # Prova vari formati di data
            for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                try:
                    end_date = datetime.strptime(end_date_str, fmt).date()
                    if end_date < datetime.utcnow().date():
                        return False
                    break
                except ValueError:
                    continue
        except:
            pass
    
    return True

def get_subscription_info(user: dict) -> Optional[dict]:
    """Restituisce info abbonamento"""
    # Il proprietario ha abbonamento lifetime
    if user.get("email") in OWNER_EMAILS or user.get("is_owner") == True:
        return {
            "plan": "owner",
            "status": "active",
            "start_date": "2025-01-01",
            "end_date": "2099-12-31",
            "is_active": True
        }
    
    subscription = user.get("subscription")
    if subscription:
        return {
            "plan": subscription.get("plan", "none"),
            "status": subscription.get("status", "inactive"),
            "start_date": subscription.get("start_date"),
            "end_date": subscription.get("end_date"),
            "is_active": check_subscription_active(user)
        }
    return {
        "plan": "none",
        "status": "inactive",
        "start_date": None,
        "end_date": None,
        "is_active": False
    }

async def ensure_coach_has_subscription(user: dict) -> dict:
    """Assegna abbonamento trial se il coach non ne ha uno"""
    if user.get("role") == "coach" and not user.get("subscription"):
        trial_end = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        subscription = {
            "plan": "trial",
            "status": "active",
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "end_date": trial_end
        }
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"subscription": subscription}}
        )
        user["subscription"] = subscription
    return user

# Dependency per verificare abbonamento attivo per operazioni di scrittura
async def require_active_subscription(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "coach" and not check_subscription_active(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Abbonamento scaduto o non attivo. Rinnova per modificare i dati."
        )
    return current_user

@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user.dict()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = get_password_hash(user.password)
    user_dict["created_at"] = datetime.utcnow()
    
    # Default subscription per coach: trial attivo per 30 giorni
    if user_dict.get("role") == "coach":
        trial_end = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        user_dict["subscription"] = {
            "plan": "trial",
            "status": "active",
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "end_date": trial_end
        }
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user_dict["id"]})
    
    subscription_data = get_subscription_info(user_dict)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            name=user_dict["name"],
            role=user_dict["role"],
            coach_id=user_dict.get("coach_id"),
            subscription=SubscriptionInfo(**subscription_data) if subscription_data else None
        )
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Assegna abbonamento trial se il coach non ne ha uno
    user = await ensure_coach_has_subscription(user)
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    subscription_data = get_subscription_info(user)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            coach_id=user.get("coach_id"),
            subscription=SubscriptionInfo(**subscription_data) if subscription_data else None
        )
    )

@api_router.post("/auth/athlete-login", response_model=Token)
async def athlete_login(credentials: AthleteLoginRequest):
    """Login per atleti con email e codice accesso"""
    # Trova l'atleta con email e codice accesso
    athlete = await db.athletes.find_one({
        "email": credentials.email,
        "access_code": credentials.access_code
    })
    
    if not athlete:
        raise HTTPException(status_code=401, detail="Email o codice accesso non valido")
    
    # Crea o trova l'utente atleta
    user = await db.users.find_one({"email": credentials.email, "role": "athlete"})
    
    if not user:
        # Crea un nuovo utente atleta
        user = {
            "id": str(uuid.uuid4()),
            "email": credentials.email,
            "name": athlete["name"],
            "role": "athlete",
            "coach_id": athlete["coach_id"],
            "athlete_profile_id": athlete["id"],
            "password": "",  # Atleti usano codice accesso, non password
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user)
        
        # Collega l'atleta all'utente
        await db.athletes.update_one(
            {"id": athlete["id"]},
            {"$set": {"user_id": user["id"]}}
        )
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role="athlete",
            coach_id=user.get("coach_id"),
            subscription=None  # Atleti non hanno abbonamento
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    subscription_data = get_subscription_info(current_user)
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        coach_id=current_user.get("coach_id"),
        subscription=SubscriptionInfo(**subscription_data) if subscription_data else None
    )

@api_router.put("/auth/subscription")
async def update_subscription(
    subscription: SubscriptionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Aggiorna lo stato dell'abbonamento del coach"""
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Solo i coach possono avere abbonamenti")
    
    # Calcola date
    start_date = datetime.utcnow().strftime("%Y-%m-%d")
    if subscription.plan == "monthly":
        end_date = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
    elif subscription.plan == "annual":
        end_date = (datetime.utcnow() + timedelta(days=365)).strftime("%Y-%m-%d")
    else:
        end_date = None
    
    subscription_data = {
        "plan": subscription.plan,
        "status": subscription.status,
        "start_date": start_date,
        "end_date": end_date
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"subscription": subscription_data}}
    )
    
    return {"message": "Abbonamento aggiornato", "subscription": subscription_data}

@api_router.get("/auth/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Ottieni lo stato dell'abbonamento"""
    return get_subscription_info(current_user)

# ==================== ATHLETE PROFILE ROUTES ====================

import random
import string

def generate_access_code():
    """Genera codice accesso a 6 caratteri alfanumerici"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@api_router.post("/athletes", response_model=AthleteProfile)
async def create_athlete(athlete: AthleteProfileCreate, current_user: dict = Depends(require_active_subscription)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create athletes")
    
    athlete_dict = athlete.dict()
    athlete_dict["id"] = str(uuid.uuid4())
    athlete_dict["coach_id"] = current_user["id"]
    athlete_dict["access_code"] = generate_access_code()  # Genera codice accesso
    athlete_dict["biometrics"] = BiometricData().dict()
    athlete_dict["medical_certificate"] = MedicalCertificate().dict()
    athlete_dict["payments"] = []
    athlete_dict["connected_platforms"] = {
        "garmin": False,
        "polar": False,
        "suunto": False,
        "strava": False,
        "fitbit": False
    }
    athlete_dict["created_at"] = datetime.utcnow()
    athlete_dict["updated_at"] = datetime.utcnow()
    
    # If password provided, create user account for athlete
    if athlete.password:
        # Check if user exists
        existing_user = await db.users.find_one({"email": athlete.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered as user")
        
        user_dict = {
            "id": str(uuid.uuid4()),
            "email": athlete.email,
            "name": athlete.name,
            "role": "athlete",
            "password": get_password_hash(athlete.password),
            "coach_id": current_user["id"],
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        athlete_dict["user_id"] = user_dict["id"]
    
    del athlete_dict["password"]
    await db.athletes.insert_one(athlete_dict)
    
    return AthleteProfile(**athlete_dict)

@api_router.get("/athletes", response_model=List[AthleteProfile])
async def get_athletes(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "coach":
        athletes = await db.athletes.find({"coach_id": current_user["id"]}).to_list(1000)
    else:
        # Athletes can only see their own profile
        athletes = await db.athletes.find({"user_id": current_user["id"]}).to_list(1)
    
    return [AthleteProfile(**a) for a in athletes]

@api_router.get("/athletes/{athlete_id}", response_model=AthleteProfile)
async def get_athlete(athlete_id: str, current_user: dict = Depends(get_current_user)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Check permission
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == "athlete" and athlete.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return AthleteProfile(**athlete)

@api_router.put("/athletes/{athlete_id}", response_model=AthleteProfile)
async def update_athlete(athlete_id: str, update: AthleteProfileUpdate, current_user: dict = Depends(require_active_subscription)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if update_dict:
        if "biometrics" in update_dict:
            update_dict["biometrics"] = update_dict["biometrics"]
        if "medical_certificate" in update_dict:
            update_dict["medical_certificate"] = update_dict["medical_certificate"]
        update_dict["updated_at"] = datetime.utcnow()
        await db.athletes.update_one({"id": athlete_id}, {"$set": update_dict})
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    return AthleteProfile(**athlete)

@api_router.delete("/athletes/{athlete_id}")
async def delete_athlete(athlete_id: str, current_user: dict = Depends(require_active_subscription)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can delete athletes")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete associated user account if exists
    if athlete.get("user_id"):
        await db.users.delete_one({"id": athlete["user_id"]})
    
    await db.athletes.delete_one({"id": athlete_id})
    return {"message": "Athlete deleted successfully"}

# ==================== PAYMENT ROUTES ====================

@api_router.post("/athletes/{athlete_id}/payments", response_model=PaymentRecord)
async def add_payment(athlete_id: str, payment: PaymentRecord, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can manage payments")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    payment_dict = payment.dict()
    payment_dict["id"] = str(uuid.uuid4())
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$push": {"payments": payment_dict}}
    )
    
    return PaymentRecord(**payment_dict)

@api_router.put("/athletes/{athlete_id}/payments/{payment_id}")
async def update_payment(athlete_id: str, payment_id: str, paid: bool, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can manage payments")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    paid_date = datetime.utcnow().strftime("%Y-%m-%d") if paid else None
    
    await db.athletes.update_one(
        {"id": athlete_id, "payments.id": payment_id},
        {"$set": {"payments.$.paid": paid, "payments.$.paid_date": paid_date}}
    )
    
    return {"message": "Payment updated"}

# ==================== TRAINING PROGRAM ROUTES ====================

@api_router.post("/programs", response_model=TrainingProgram)
async def create_program(program: TrainingProgramCreate, current_user: dict = Depends(require_active_subscription)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create programs")
    
    # Verify athlete belongs to coach
    athlete = await db.athletes.find_one({"id": program.athlete_id})
    if not athlete or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    program_dict = program.dict()
    program_dict["id"] = str(uuid.uuid4())
    program_dict["coach_id"] = current_user["id"]
    program_dict["created_at"] = datetime.utcnow()
    program_dict["updated_at"] = datetime.utcnow()
    
    # Ensure workouts have IDs
    for workout in program_dict["workouts"]:
        if not workout.get("id"):
            workout["id"] = str(uuid.uuid4())
    
    await db.programs.insert_one(program_dict)
    
    return TrainingProgram(**program_dict)

@api_router.get("/programs", response_model=List[TrainingProgram])
async def get_programs(athlete_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user["role"] == "coach":
        query["coach_id"] = current_user["id"]
        if athlete_id:
            query["athlete_id"] = athlete_id
    else:
        # Get athlete profile for this user
        athlete = await db.athletes.find_one({"user_id": current_user["id"]})
        if athlete:
            query["athlete_id"] = athlete["id"]
        else:
            return []
    
    programs = await db.programs.find(query).to_list(1000)
    return [TrainingProgram(**p) for p in programs]

@api_router.get("/programs/{program_id}", response_model=TrainingProgram)
async def get_program(program_id: str, current_user: dict = Depends(get_current_user)):
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Check permission
    if current_user["role"] == "coach" and program["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return TrainingProgram(**program)

@api_router.put("/programs/{program_id}", response_model=TrainingProgram)
async def update_program(program_id: str, update: TrainingProgramUpdate, current_user: dict = Depends(require_active_subscription)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can update programs")
    
    program = await db.programs.find_one({"id": program_id})
    if not program or program["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Program not found")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if update_dict:
        # Ensure workouts have IDs
        if "workouts" in update_dict:
            for workout in update_dict["workouts"]:
                if not workout.get("id"):
                    workout["id"] = str(uuid.uuid4())
        update_dict["updated_at"] = datetime.utcnow()
        await db.programs.update_one({"id": program_id}, {"$set": update_dict})
    
    program = await db.programs.find_one({"id": program_id})
    return TrainingProgram(**program)

@api_router.delete("/programs/{program_id}")
async def delete_program(program_id: str, current_user: dict = Depends(require_active_subscription)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can delete programs")
    
    program = await db.programs.find_one({"id": program_id})
    if not program or program["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Program not found")
    
    await db.programs.delete_one({"id": program_id})
    return {"message": "Program deleted successfully"}

# ==================== WORKOUT COMPLETION (with notification to coach) ====================

@api_router.put("/programs/{program_id}/workouts/{workout_id}/complete")
async def complete_workout(
    program_id: str,
    workout_id: str,
    completion_data: Optional[WorkoutCompletionData] = None,
    current_user: dict = Depends(get_current_user)
):
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Find the workout
    workout = None
    for w in program.get("workouts", []):
        if w.get("id") == workout_id:
            workout = w
            break
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    completed_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Prepare actual data
    actual_data = {}
    if completion_data:
        actual_data = {k: v for k, v in completion_data.dict().items() if v is not None}
    
    await db.programs.update_one(
        {"id": program_id, "workouts.id": workout_id},
        {"$set": {
            "workouts.$.completed": True,
            "workouts.$.completed_date": completed_date,
            "workouts.$.actual_data": actual_data
        }}
    )
    
    # Get athlete info
    athlete = await db.athletes.find_one({"id": program["athlete_id"]})
    athlete_name = athlete["name"] if athlete else "Atleta"
    
    # Send notification to coach
    notification = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_id": program["coach_id"],
        "title": f"Allenamento completato - {athlete_name}",
        "message": f"{athlete_name} ha completato '{workout.get('title', 'Allenamento')}'",
        "notification_type": "workout_completed",
        "read": False,
        "related_data": {
            "program_id": program_id,
            "program_name": program.get("name"),
            "workout_id": workout_id,
            "workout_title": workout.get("title"),
            "workout_type": workout.get("workout_type"),
            "athlete_id": program["athlete_id"],
            "athlete_name": athlete_name,
            "completed_date": completed_date,
            "actual_data": actual_data
        },
        "created_at": datetime.utcnow()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Workout marked as complete", "notification_sent": True}

# ==================== ATHLETE PROFILE (for athlete view) ====================

@api_router.get("/athlete/profile")
async def get_athlete_profile(current_user: dict = Depends(get_current_user)):
    """Get athlete profile for the logged-in athlete"""
    if current_user["role"] != "athlete":
        raise HTTPException(status_code=403, detail="Only athletes can access this endpoint")
    
    # Find athlete profile linked to this user
    athlete = await db.athletes.find_one({"user_id": current_user["id"]})
    if not athlete:
        # Try to find by email
        athlete = await db.athletes.find_one({"email": current_user["email"]})
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete profile not found")
    
    return {
        "id": athlete["id"],
        "name": athlete["name"],
        "email": athlete["email"],
        "payments": athlete.get("payments", []),
        "medical_certificate": athlete.get("medical_certificate", {}),
        "biometrics": athlete.get("biometrics", {})
    }

@api_router.put("/programs/{program_id}/workouts/{workout_id}/edit")
async def edit_workout(
    program_id: str,
    workout_id: str,
    edit_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Allow athlete to edit their completed workout (once only)"""
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Find the workout
    workout_index = None
    for i, w in enumerate(program.get("workouts", [])):
        if w.get("id") == workout_id:
            workout_index = i
            break
    
    if workout_index is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    workout = program["workouts"][workout_index]
    
    # Check if already modified
    if workout.get("modified_by_athlete"):
        raise HTTPException(status_code=400, detail="Questo allenamento è già stato modificato")
    
    # Update the workout data
    if not workout.get("actual_data"):
        workout["actual_data"] = {}
    
    workout["actual_data"]["duration_minutes"] = edit_data.get("duration_minutes")
    workout["actual_data"]["distance_km"] = edit_data.get("distance_km")
    workout["actual_data"]["fatigue_level"] = edit_data.get("fatigue_level")
    workout["actual_data"]["notes"] = edit_data.get("notes")
    workout["actual_data"]["modified_at"] = datetime.utcnow().isoformat()
    workout["modified_by_athlete"] = True
    
    # Update the program
    program["workouts"][workout_index] = workout
    await db.programs.update_one(
        {"id": program_id},
        {"$set": {"workouts": program["workouts"]}}
    )
    
    # Get athlete info for notification
    athlete = await db.athletes.find_one({"id": program["athlete_id"]})
    athlete_name = athlete["name"] if athlete else "Atleta"
    
    # Create notification for coach
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_id": program["coach_id"],
        "notification_type": "workout_modified",
        "title": f"Allenamento modificato - {athlete_name}",
        "message": f"{athlete_name} ha modificato i dati dell'allenamento '{workout.get('title', 'Allenamento')}'",
        "read": False,
        "related_data": {
            "program_id": program_id,
            "workout_id": workout_id,
            "athlete_id": program["athlete_id"],
            "athlete_name": athlete_name,
            "modified_data": edit_data
        },
        "created_at": datetime.utcnow()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Workout modified", "notification_sent": True}

# ==================== CALENDAR ROUTES ====================

@api_router.get("/calendar/workouts")
async def get_calendar_workouts(
    athlete_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all workouts for calendar view"""
    query = {}
    
    if current_user["role"] == "coach":
        query["coach_id"] = current_user["id"]
        if athlete_id:
            query["athlete_id"] = athlete_id
    else:
        athlete = await db.athletes.find_one({"user_id": current_user["id"]})
        if athlete:
            query["athlete_id"] = athlete["id"]
        else:
            return {"workouts": []}
    
    programs = await db.programs.find(query).to_list(1000)
    
    calendar_workouts = []
    for program in programs:
        athlete = await db.athletes.find_one({"id": program["athlete_id"]})
        athlete_name = athlete["name"] if athlete else "Atleta"
        
        for workout in program.get("workouts", []):
            # Use workout date if available, otherwise use day field
            workout_date = workout.get("date") or workout.get("day")
            
            # Filter by date range if provided
            if start_date and workout_date and workout_date < start_date:
                continue
            if end_date and workout_date and workout_date > end_date:
                continue
            
            calendar_workouts.append({
                "id": workout.get("id"),
                "program_id": program["id"],
                "program_name": program.get("name"),
                "athlete_id": program["athlete_id"],
                "athlete_name": athlete_name,
                "date": workout_date,
                "title": workout.get("title"),
                "description": workout.get("description"),
                "workout_type": workout.get("workout_type"),
                "duration_minutes": workout.get("duration_minutes"),
                "distance_km": workout.get("distance_km"),
                "target_pace": workout.get("target_pace"),
                "heart_rate_zone": workout.get("heart_rate_zone"),
                "completed": workout.get("completed", False),
                "completed_date": workout.get("completed_date"),
                "actual_data": workout.get("actual_data")
            })
    
    # Sort by date
    calendar_workouts.sort(key=lambda x: x.get("date") or "")
    
    return {"workouts": calendar_workouts}

@api_router.get("/calendar/activities")
async def get_calendar_activities(
    athlete_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all activities for calendar view"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"athlete_id": athlete_id}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    activities = await db.activities.find(query).sort("date", -1).to_list(1000)
    
    return {"activities": [ActivityData(**a).dict() for a in activities]}

# ==================== NOTIFICATION ROUTES ====================

@api_router.post("/notifications", response_model=Notification)
async def create_notification(notification: NotificationCreate, current_user: dict = Depends(get_current_user)):
    notif_dict = notification.dict()
    notif_dict["id"] = str(uuid.uuid4())
    notif_dict["sender_id"] = current_user["id"]
    notif_dict["read"] = False
    notif_dict["created_at"] = datetime.utcnow()
    
    await db.notifications.insert_one(notif_dict)
    
    return Notification(**notif_dict)

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"recipient_id": current_user["id"]}
    ).sort("created_at", -1).to_list(100)
    
    # Process notifications to ensure all required fields are present
    processed = []
    for n in notifications:
        # Handle _id conversion
        if "_id" in n:
            del n["_id"]
        # Ensure id field exists
        if "id" not in n:
            n["id"] = str(uuid.uuid4())
        # sender_id is now optional
        processed.append(Notification(**n))
    
    return processed

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({
        "recipient_id": current_user["id"],
        "read": False
    })
    return {"count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "recipient_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"recipient_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a single notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "recipient_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}

@api_router.delete("/notifications")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Delete all notifications for current user"""
    await db.notifications.delete_many({"recipient_id": current_user["id"]})
    return {"message": "All notifications deleted"}

# ==================== ACTIVITY DATA ROUTES ====================

@api_router.post("/activities", response_model=ActivityData)
async def create_activity(activity: ActivityDataCreate, current_user: dict = Depends(get_current_user)):
    # Verify permission
    athlete = await db.athletes.find_one({"id": activity.athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == "athlete" and athlete.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    activity_dict = activity.dict()
    activity_dict["id"] = str(uuid.uuid4())
    activity_dict["created_at"] = datetime.utcnow()
    
    await db.activities.insert_one(activity_dict)
    
    return ActivityData(**activity_dict)

@api_router.post("/activities/upload-gpx")
async def upload_gpx_activity(
    athlete_id: str,
    activity_type: str = "running",
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and parse GPX file to create activity"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    content = await file.read()
    gpx_data = parse_gpx_file(content.decode('utf-8'))
    
    activity_dict = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "date": gpx_data["date"],
        "activity_type": activity_type,
        "duration_minutes": gpx_data["duration_minutes"],
        "distance_km": gpx_data["distance_km"],
        "avg_pace": gpx_data["avg_pace"],
        "avg_heart_rate": gpx_data.get("avg_heart_rate"),
        "max_heart_rate": gpx_data.get("max_heart_rate"),
        "elevation_gain": gpx_data.get("elevation_gain"),
        "source": "gpx",
        "gpx_points": gpx_data.get("gpx_points"),
        "created_at": datetime.utcnow()
    }
    
    await db.activities.insert_one(activity_dict)
    
    return ActivityData(**activity_dict)

@api_router.post("/activities/upload-fit")
async def upload_fit_activity(
    athlete_id: str,
    activity_type: str = "running",
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and parse FIT file to create activity"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    content = await file.read()
    fit_data = parse_fit_file(content)
    
    activity_dict = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "date": fit_data["date"],
        "activity_type": activity_type,
        "duration_minutes": fit_data["duration_minutes"],
        "distance_km": fit_data["distance_km"],
        "avg_pace": fit_data["avg_pace"],
        "avg_heart_rate": fit_data.get("avg_heart_rate"),
        "max_heart_rate": fit_data.get("max_heart_rate"),
        "elevation_gain": fit_data.get("elevation_gain"),
        "source": "fit",
        "created_at": datetime.utcnow()
    }
    
    await db.activities.insert_one(activity_dict)
    
    return ActivityData(**activity_dict)

@api_router.get("/activities", response_model=List[ActivityData])
async def get_activities(
    athlete_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Verify permission
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"athlete_id": athlete_id}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    activities = await db.activities.find(query).sort("date", -1).to_list(1000)
    
    return [ActivityData(**a) for a in activities]

# ==================== ANALYTICS & COMPARISON ROUTES ====================

@api_router.get("/analytics/athlete/{athlete_id}")
async def get_athlete_analytics(
    athlete_id: str,
    period: str = "month",  # week, month, year
    current_user: dict = Depends(get_current_user)
):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    else:
        start_date = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    
    activities = await db.activities.find({
        "athlete_id": athlete_id,
        "date": {"$gte": start_date}
    }).to_list(1000)
    
    # Calculate analytics
    total_distance = sum(a.get("distance_km", 0) or 0 for a in activities)
    total_duration = sum(a.get("duration_minutes", 0) or 0 for a in activities)
    total_activities = len(activities)
    
    # Heart rate zones distribution
    hr_zones = {"zone1": 0, "zone2": 0, "zone3": 0, "zone4": 0, "zone5": 0}
    hr_max = athlete.get("biometrics", {}).get("heart_rate_max", 190)
    
    for a in activities:
        avg_hr = a.get("avg_heart_rate")
        if avg_hr and hr_max:
            pct = (avg_hr / hr_max) * 100
            if pct < 60:
                hr_zones["zone1"] += 1
            elif pct < 70:
                hr_zones["zone2"] += 1
            elif pct < 80:
                hr_zones["zone3"] += 1
            elif pct < 90:
                hr_zones["zone4"] += 1
            else:
                hr_zones["zone5"] += 1
    
    # Pace trend (last 10 activities)
    pace_trend = []
    for a in sorted(activities, key=lambda x: x.get("date", ""))[-10:]:
        if a.get("avg_pace"):
            pace_trend.append({
                "date": a.get("date"),
                "pace": a.get("avg_pace")
            })
    
    return {
        "period": period,
        "total_distance_km": round(total_distance, 2),
        "total_duration_minutes": total_duration,
        "total_activities": total_activities,
        "avg_distance_per_activity": round(total_distance / max(total_activities, 1), 2),
        "heart_rate_zones": hr_zones,
        "pace_trend": pace_trend,
        "biometrics": athlete.get("biometrics", {})
    }

@api_router.get("/analytics/compare/{athlete_id}")
async def compare_athlete_data(
    athlete_id: str,
    period1_start: str,
    period1_end: str,
    period2_start: str,
    period2_end: str,
    current_user: dict = Depends(get_current_user)
):
    """Compare athlete performance between two time periods"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get activities for period 1
    activities1 = await db.activities.find({
        "athlete_id": athlete_id,
        "date": {"$gte": period1_start, "$lte": period1_end}
    }).to_list(1000)
    
    # Get activities for period 2
    activities2 = await db.activities.find({
        "athlete_id": athlete_id,
        "date": {"$gte": period2_start, "$lte": period2_end}
    }).to_list(1000)
    
    def calculate_period_stats(activities):
        if not activities:
            return {
                "total_distance_km": 0,
                "total_duration_minutes": 0,
                "total_activities": 0,
                "avg_distance_per_activity": 0,
                "avg_pace": None,
                "avg_heart_rate": None,
                "total_elevation": 0
            }
        
        total_distance = sum(a.get("distance_km", 0) or 0 for a in activities)
        total_duration = sum(a.get("duration_minutes", 0) or 0 for a in activities)
        total_elevation = sum(a.get("elevation_gain", 0) or 0 for a in activities)
        heart_rates = [a.get("avg_heart_rate") for a in activities if a.get("avg_heart_rate")]
        
        # Calculate average pace
        avg_pace = None
        if total_distance > 0 and total_duration > 0:
            pace_min = total_duration / total_distance
            pace_sec = (pace_min % 1) * 60
            avg_pace = f"{int(pace_min)}:{int(pace_sec):02d}"
        
        return {
            "total_distance_km": round(total_distance, 2),
            "total_duration_minutes": total_duration,
            "total_activities": len(activities),
            "avg_distance_per_activity": round(total_distance / len(activities), 2),
            "avg_pace": avg_pace,
            "avg_heart_rate": int(sum(heart_rates) / len(heart_rates)) if heart_rates else None,
            "total_elevation": total_elevation
        }
    
    period1_stats = calculate_period_stats(activities1)
    period2_stats = calculate_period_stats(activities2)
    
    # Calculate differences
    def calc_diff(v1, v2):
        if v1 is None or v2 is None:
            return None
        if v2 == 0:
            return None
        return round(((v1 - v2) / v2) * 100, 1)
    
    comparison = {
        "period1": {
            "start": period1_start,
            "end": period1_end,
            "stats": period1_stats
        },
        "period2": {
            "start": period2_start,
            "end": period2_end,
            "stats": period2_stats
        },
        "differences": {
            "distance_change_pct": calc_diff(period1_stats["total_distance_km"], period2_stats["total_distance_km"]),
            "duration_change_pct": calc_diff(period1_stats["total_duration_minutes"], period2_stats["total_duration_minutes"]),
            "activities_change_pct": calc_diff(period1_stats["total_activities"], period2_stats["total_activities"]),
            "elevation_change_pct": calc_diff(period1_stats["total_elevation"], period2_stats["total_elevation"]),
        },
        "summary": {
            "improved_distance": period1_stats["total_distance_km"] > period2_stats["total_distance_km"],
            "improved_volume": period1_stats["total_activities"] > period2_stats["total_activities"],
        }
    }
    
    return comparison

# ==================== EXPIRY CHECK ROUTES ====================

@api_router.get("/check-expiries")
async def check_expiries(current_user: dict = Depends(get_current_user)):
    # Solo i coach possono vedere le scadenze, gli atleti ottengono lista vuota
    if current_user["role"] != "coach":
        return {"warnings": []}
    
    athletes = await db.athletes.find({"coach_id": current_user["id"]}).to_list(1000)
    
    warnings = []
    today = datetime.utcnow().date()
    
    # Helper function per parsare date in vari formati
    def parse_date_safe(date_string):
        if not date_string:
            return None
        formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]
        for fmt in formats:
            try:
                return datetime.strptime(date_string, fmt).date()
            except ValueError:
                continue
        return None
    
    for athlete in athletes:
        # Check medical certificate
        cert = athlete.get("medical_certificate", {})
        if cert.get("expiry_date"):
            expiry = parse_date_safe(cert["expiry_date"])
            if expiry:
                days_until = (expiry - today).days
                if days_until <= 30:
                    warnings.append({
                        "type": "certificate_expiry",
                        "athlete_id": athlete["id"],
                        "athlete_name": athlete["name"],
                        "days_until": days_until,
                        "expiry_date": cert["expiry_date"],
                        "urgent": days_until <= 7
                    })
        
        # Check unpaid payments
        for payment in athlete.get("payments", []):
            if not payment.get("paid"):
                due_date = parse_date_safe(payment.get("due_date"))
                if due_date:
                    days_overdue = (today - due_date).days
                    if days_overdue >= 0:
                        warnings.append({
                            "type": "payment_due",
                            "athlete_id": athlete["id"],
                            "athlete_name": athlete["name"],
                            "payment_id": payment["id"],
                            "month": payment["month"],
                            "amount": payment["amount"],
                            "days_overdue": days_overdue,
                            "urgent": days_overdue >= 7
                        })
    
    return {"warnings": warnings}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "RunCoach Pro API", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
