from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from bson import ObjectId
import gpxpy
import io
import base64

# Stripe Integration
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

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
    # Feedback atleta
    feedback_sent: bool = False
    feedback_date: Optional[str] = None
    athlete_feedback: Optional[dict] = None
    modified_by_athlete: bool = False

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
    activity_type: str = "running"  # Default to running if not specified
    duration_minutes: Optional[int] = None
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
    completed: bool = False
    feedback_sent: bool = False
    athlete_feedback: Optional[dict] = None
    actual_data: Optional[dict] = None
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
    # Feedback atleta
    fatigue_level: Optional[int] = None  # 1-10
    has_pain: Optional[bool] = None
    pain_location: Optional[str] = None
    # Skip data
    skipped: Optional[bool] = None
    skip_reason: Optional[str] = None

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
# Free tier constant
FREE_TIER_ATHLETE_LIMIT = 1

async def require_active_subscription(current_user: dict = Depends(get_current_user)):
    """
    Freemium model:
    - Free: max 1 athlete
    - Premium: unlimited athletes
    """
    if current_user.get("role") != "coach":
        return current_user
    
    coach_id = current_user["id"]
    
    # Check for active subscription in new subscriptions collection
    subscription = await db.subscriptions.find_one({
        "coach_id": coach_id,
        "status": "active",
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    # Also check old subscription model
    old_sub = current_user.get("subscription", {})
    old_sub_active = False
    if old_sub:
        try:
            end_date = datetime.strptime(old_sub.get("end_date", "2000-01-01"), "%Y-%m-%d")
            old_sub_active = end_date > datetime.utcnow() and old_sub.get("status") == "active"
        except:
            pass
    
    is_premium = subscription is not None or old_sub_active
    
    if is_premium:
        return current_user
    
    # Free tier - check athlete count
    athlete_count = await db.athletes.count_documents({"coach_id": coach_id})
    
    # Allow max 1 athlete for free tier
    if athlete_count >= FREE_TIER_ATHLETE_LIMIT:
        raise HTTPException(
            status_code=403, 
            detail=f"Piano gratuito limitato a {FREE_TIER_ATHLETE_LIMIT} atleta. Passa a Premium per aggiungere più atleti."
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

# ==================== NOTIFICATION SETTINGS ROUTES ====================

class NotificationSettingsUpdate(BaseModel):
    notify_athlete_feedback: Optional[bool] = None
    notify_expirations: Optional[bool] = None
    # Athlete-specific settings
    notify_assigned_workouts: Optional[bool] = None
    notify_daily_reminder: Optional[bool] = None

@api_router.get("/users/me/notification-settings")
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    """Get user's notification settings"""
    settings = current_user.get("notification_settings", {})
    
    # Return defaults based on role
    if current_user.get("role") == "coach":
        return {
            "notify_athlete_feedback": settings.get("notify_athlete_feedback", True),
            "notify_expirations": settings.get("notify_expirations", True)
        }
    else:  # athlete
        return {
            "notify_assigned_workouts": settings.get("notify_assigned_workouts", True),
            "notify_daily_reminder": settings.get("notify_daily_reminder", True),
            "notify_expirations": settings.get("notify_expirations", True)
        }

@api_router.put("/users/me/notification-settings")
async def update_notification_settings(
    settings: NotificationSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification settings"""
    settings_dict = {k: v for k, v in settings.dict().items() if v is not None}
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"notification_settings": settings_dict}}
    )
    
    return {"message": "Notification settings updated", "settings": settings_dict}

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
    """Athlete sends feedback to coach - triggers notification"""
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
    
    # Prepare feedback data from athlete
    feedback_data = {}
    if completion_data:
        feedback_data = {k: v for k, v in completion_data.dict().items() if v is not None}
    
    # Mark as feedback sent (not fully completed yet)
    await db.programs.update_one(
        {"id": program_id, "workouts.id": workout_id},
        {"$set": {
            "workouts.$.feedback_sent": True,
            "workouts.$.feedback_date": completed_date,
            "workouts.$.athlete_feedback": feedback_data
        }}
    )
    
    # Get athlete info
    athlete = await db.athletes.find_one({"id": program["athlete_id"]})
    athlete_name = athlete["name"] if athlete else "Atleta"
    
    # Send notification to coach with athlete feedback
    notification = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_id": program["coach_id"],
        "title": f"Feedback allenamento - {athlete_name}",
        "message": f"{athlete_name} ha inviato il feedback per '{workout.get('title', 'Allenamento')}'",
        "notification_type": "workout_feedback",
        "read": False,
        "related_data": {
            "program_id": program_id,
            "program_name": program.get("name"),
            "workout_id": workout_id,
            "workout_title": workout.get("title"),
            "workout_type": workout.get("workout_type"),
            "athlete_id": program["athlete_id"],
            "athlete_name": athlete_name,
            "feedback_date": completed_date,
            "athlete_feedback": feedback_data
        },
        "created_at": datetime.utcnow()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Feedback sent to coach", "notification_sent": True}


@api_router.put("/programs/{program_id}/workouts/{workout_id}/finalize")
async def finalize_workout(
    program_id: str,
    workout_id: str,
    actual_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Coach finalizes workout with actual training data - updates analytics, NO notification"""
    # Only coach can finalize
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coach can finalize workouts")
    
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    if program["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the workout
    workout = None
    for w in program.get("workouts", []):
        if w.get("id") == workout_id:
            workout = w
            break
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    completed_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Update workout as completed with actual data
    await db.programs.update_one(
        {"id": program_id, "workouts.id": workout_id},
        {"$set": {
            "workouts.$.completed": True,
            "workouts.$.completed_date": completed_date,
            "workouts.$.actual_data": actual_data
        }}
    )
    
    # Update athlete analytics with actual training data
    activity_record = {
        "id": str(uuid.uuid4()),
        "athlete_id": program["athlete_id"],
        "program_id": program_id,
        "workout_id": workout_id,
        "date": workout.get("date", completed_date),
        "workout_type": workout.get("workout_type", "training"),
        "title": workout.get("title", "Allenamento"),
        "duration_minutes": actual_data.get("duration_minutes"),
        "distance_km": actual_data.get("distance_km"),
        "avg_pace": actual_data.get("avg_pace"),
        "avg_heart_rate": actual_data.get("avg_heart_rate"),
        "max_heart_rate": actual_data.get("max_heart_rate"),
        "calories": actual_data.get("calories"),
        "notes": actual_data.get("notes"),
        "created_at": datetime.utcnow()
    }
    
    # Insert into activities collection for analytics
    await db.activities.insert_one(activity_record)
    
    return {"message": "Workout finalized", "analytics_updated": True}

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
        "sender_id": current_user["id"],  # The athlete who modified the workout
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
    """Get all workouts for calendar view (includes both program workouts and standalone activities)"""
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
                "actual_data": workout.get("actual_data"),
                "is_standalone": False
            })
    
    # Get standalone activities (fuori programma)
    activity_query = {}
    if current_user["role"] == "coach":
        # Get all athlete ids for this coach
        coach_athletes = await db.athletes.find({"coach_id": current_user["id"]}).to_list(1000)
        athlete_ids = [a["id"] for a in coach_athletes]
        if athlete_id:
            activity_query["athlete_id"] = athlete_id
        else:
            activity_query["athlete_id"] = {"$in": athlete_ids}
    else:
        athlete = await db.athletes.find_one({"user_id": current_user["id"]})
        if athlete:
            activity_query["athlete_id"] = athlete["id"]
    
    if start_date:
        activity_query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in activity_query:
            activity_query["date"]["$lte"] = end_date
        else:
            activity_query["date"] = {"$lte": end_date}
    
    activities = await db.activities.find(activity_query).to_list(1000)
    
    for activity in activities:
        athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
        athlete_name = athlete["name"] if athlete else "Atleta"
        
        calendar_workouts.append({
            "id": activity.get("id"),
            "program_id": None,
            "program_name": "Fuori Programma",
            "athlete_id": activity["athlete_id"],
            "athlete_name": athlete_name,
            "date": activity.get("date"),
            "title": f"{activity.get('activity_type', 'Attività').title()}",
            "description": f"Durata: {activity.get('duration_minutes', 0)} min, Distanza: {activity.get('distance_km', 0)} km",
            "workout_type": activity.get("activity_type", "other"),
            "duration_minutes": activity.get("duration_minutes"),
            "distance_km": activity.get("distance_km"),
            "target_pace": activity.get("avg_pace"),
            "heart_rate_zone": None,
            "completed": activity.get("completed", False),  # Not completed until athlete gives feedback
            "feedback_sent": activity.get("feedback_sent", False),
            "athlete_feedback": activity.get("athlete_feedback"),
            "completed_date": activity.get("completed_date"),
            "actual_data": activity.get("actual_data"),
            "is_standalone": True
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
    
    # If coach creates activity, send notification to athlete
    if current_user["role"] == "coach" and athlete.get("user_id"):
        notification = {
            "id": str(uuid.uuid4()),
            "sender_id": current_user["id"],
            "recipient_id": athlete["user_id"],
            "title": "Nuova attività assegnata",
            "message": f"Il tuo coach ti ha assegnato una nuova attività: {activity.activity_type.title()} - {activity.date}",
            "notification_type": "activity_assigned",
            "read": False,
            "related_data": {
                "activity_id": activity_dict["id"],
                "activity_type": activity.activity_type,
                "date": activity.date,
                "duration_minutes": activity.duration_minutes,
                "distance_km": activity.distance_km
            },
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
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

@api_router.get("/activities/{activity_id}")
async def get_activity(
    activity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single activity by ID"""
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Verify permission
    athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Remove MongoDB _id and ensure defaults
    if "_id" in activity:
        del activity["_id"]
    if "activity_type" not in activity or not activity["activity_type"]:
        activity["activity_type"] = "running"
    
    return activity


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
    
    # Process activities to ensure all fields have defaults
    result = []
    for a in activities:
        # Remove MongoDB _id
        if "_id" in a:
            del a["_id"]
        # Ensure required fields have defaults
        if "activity_type" not in a or not a["activity_type"]:
            a["activity_type"] = "running"
        if "id" not in a:
            a["id"] = str(uuid.uuid4())
        result.append(ActivityData(**a))
    
    return result


class ActivityUpdate(BaseModel):
    date: Optional[str] = None
    activity_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    avg_pace: Optional[str] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    calories: Optional[int] = None
    elevation_gain: Optional[int] = None

@api_router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: str,
    update_data: ActivityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an activity (coach only)"""
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Verify permission - only coach can update
    athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] != "coach" or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only coach can update activities")
    
    # Update only non-null fields
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.activities.update_one(
            {"id": activity_id},
            {"$set": update_dict}
        )
    
    # Get updated activity
    updated_activity = await db.activities.find_one({"id": activity_id})
    if "_id" in updated_activity:
        del updated_activity["_id"]
    
    return updated_activity

@api_router.delete("/activities/{activity_id}")
async def delete_activity(
    activity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an activity (coach only)"""
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Verify permission - only coach can delete
    athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] != "coach" or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only coach can delete activities")
    
    await db.activities.delete_one({"id": activity_id})
    
    return {"message": "Activity deleted successfully"}


@api_router.put("/activities/{activity_id}/feedback")
async def activity_feedback(
    activity_id: str,
    feedback_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Athlete sends feedback for a standalone activity"""
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Get athlete info
    athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    athlete_name = athlete["name"]
    
    # Update activity with feedback
    await db.activities.update_one(
        {"id": activity_id},
        {"$set": {
            "feedback_sent": True,
            "feedback_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "athlete_feedback": feedback_data
        }}
    )
    
    # Send notification to coach
    notification = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_id": athlete["coach_id"],
        "title": f"Feedback attività - {athlete_name}",
        "message": f"{athlete_name} ha inviato il feedback per un'attività fuori programma",
        "notification_type": "workout_feedback",
        "read": False,
        "related_data": {
            "activity_id": activity_id,
            "athlete_id": activity["athlete_id"],
            "athlete_name": athlete_name,
            "activity_type": activity.get("activity_type"),
            "feedback_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "athlete_feedback": feedback_data
        },
        "created_at": datetime.utcnow()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Feedback sent to coach"}


@api_router.put("/activities/{activity_id}/finalize")
async def finalize_activity(
    activity_id: str,
    actual_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Coach finalizes standalone activity with actual training data - updates analytics"""
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coach can finalize activities")
    
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    athlete = await db.athletes.find_one({"id": activity["athlete_id"]})
    if not athlete or athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update activity as completed
    await db.activities.update_one(
        {"id": activity_id},
        {"$set": {
            "completed": True,
            "completed_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "actual_data": actual_data
        }}
    )
    
    return {"message": "Activity finalized", "analytics_updated": True}


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
    
    # Get standalone activities
    activities = await db.activities.find({
        "athlete_id": athlete_id,
        "date": {"$gte": start_date},
        "completed": True
    }).to_list(1000)
    
    # Get completed workouts from programs and add to activities
    programs = await db.programs.find({"athlete_id": athlete_id}).to_list(1000)
    for program in programs:
        for workout in program.get("workouts", []):
            if workout.get("completed") and workout.get("date", "") >= start_date:
                actual = workout.get("actual_data", {})
                activities.append({
                    "date": workout.get("date"),
                    "distance_km": actual.get("distance_km") or workout.get("distance_km"),
                    "duration_minutes": actual.get("duration_minutes") or workout.get("duration_minutes"),
                    "avg_heart_rate": actual.get("avg_heart_rate"),
                    "avg_pace": actual.get("avg_pace"),
                    "activity_type": workout.get("workout_type", "running")
                })
    
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
    """Compare athlete performance between two time periods - includes both program workouts and standalone activities"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if current_user["role"] == "coach" and athlete["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Helper to convert date from DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
    def normalize_date(date_str: str) -> str:
        if not date_str:
            return date_str
        # Handle DD/MM/YYYY format
        if '/' in date_str and len(date_str) == 10:
            parts = date_str.split('/')
            if len(parts) == 3 and len(parts[0]) == 2 and len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
        # Handle DD-MM-YYYY format
        elif '-' in date_str and len(date_str) == 10:
            parts = date_str.split('-')
            if len(parts) == 3 and len(parts[0]) == 2 and len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return date_str
    
    # Normalize all dates to YYYY-MM-DD
    p1_start = normalize_date(period1_start)
    p1_end = normalize_date(period1_end)
    p2_start = normalize_date(period2_start)
    p2_end = normalize_date(period2_end)
    
    # Helper function to get all data (activities + program workouts) for a period
    async def get_period_data(start_date: str, end_date: str):
        all_data = []
        
        # Get standalone activities
        activities = await db.activities.find({
            "athlete_id": athlete_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }).to_list(1000)
        
        for act in activities:
            # Solo attività completate (con feedback o completed=true)
            is_completed = act.get("completed", False) or act.get("feedback_sent", False)
            if is_completed:
                all_data.append({
                    "type": "activity",
                    "date": act.get("date"),
                    "duration_minutes": act.get("actual_data", {}).get("duration_minutes") or act.get("duration_minutes") or 0,
                    "distance_km": act.get("actual_data", {}).get("distance_km") or act.get("distance_km") or 0,
                    "avg_heart_rate": act.get("actual_data", {}).get("avg_heart_rate") or act.get("avg_heart_rate"),
                })
        
        # Get program workouts
        programs = await db.programs.find({"athlete_id": athlete_id}).to_list(100)
        for program in programs:
            workouts = program.get("workouts", [])
            for workout in workouts:
                workout_date = workout.get("date", "")
                if workout_date and start_date <= workout_date <= end_date:
                    # Solo workout completati (completed=True o ha actual_data)
                    actual_data = workout.get("actual_data", {})
                    is_completed = workout.get("completed", False) or bool(actual_data)
                    
                    if is_completed:
                        all_data.append({
                            "type": "workout",
                            "date": workout_date,
                            "duration_minutes": actual_data.get("duration_minutes") or workout.get("duration_minutes") or 0,
                            "distance_km": actual_data.get("distance_km") or workout.get("distance_km") or 0,
                            "avg_heart_rate": actual_data.get("avg_heart_rate") or workout.get("avg_heart_rate"),
                        })
        
        return all_data
    
    # Get data for both periods using normalized dates
    data1 = await get_period_data(p1_start, p1_end)
    data2 = await get_period_data(p2_start, p2_end)
    
    def calculate_period_stats(data_list):
        if not data_list:
            return {
                "total_distance_km": 0,
                "total_duration_minutes": 0,
                "total_activities": 0,
                "avg_distance_per_activity": 0,
                "avg_pace": None,
                "avg_heart_rate": None,
                "workouts_count": 0,
                "activities_count": 0
            }
        
        total_distance = sum(d.get("distance_km", 0) or 0 for d in data_list)
        total_duration = sum(d.get("duration_minutes", 0) or 0 for d in data_list)
        heart_rates = [d.get("avg_heart_rate") for d in data_list if d.get("avg_heart_rate")]
        
        workouts_count = sum(1 for d in data_list if d.get("type") == "workout")
        activities_count = sum(1 for d in data_list if d.get("type") == "activity")
        
        # Calculate average pace
        avg_pace = None
        if total_distance > 0 and total_duration > 0:
            pace_min = total_duration / total_distance
            pace_sec = (pace_min % 1) * 60
            avg_pace = f"{int(pace_min)}:{int(pace_sec):02d}"
        
        return {
            "total_distance_km": round(total_distance, 2),
            "total_duration_minutes": total_duration,
            "total_activities": len(data_list),
            "avg_distance_per_activity": round(total_distance / len(data_list), 2) if data_list else 0,
            "avg_pace": avg_pace,
            "avg_heart_rate": int(sum(heart_rates) / len(heart_rates)) if heart_rates else None,
            "workouts_count": workouts_count,
            "activities_count": activities_count
        }
    
    period1_stats = calculate_period_stats(data1)
    period2_stats = calculate_period_stats(data2)
    
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
    
    coach_id = current_user["id"]
    athletes = await db.athletes.find({"coach_id": coach_id}).to_list(1000)
    
    warnings = []
    today = datetime.utcnow().date()
    
    # Helper function per parsare date in vari formati
    def parse_date_safe(date_string):
        if not date_string:
            return None
        formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(date_string, fmt).date()
            except ValueError:
                continue
        return None
    
    # Automatically check and send payment notifications
    for athlete in athletes:
        athlete_user = await db.users.find_one({"athlete_id": athlete["id"]})
        
        for payment in athlete.get("payments", []):
            if payment.get("paid"):
                continue
                
            due_date = parse_date_safe(payment.get("due_date"))
            if not due_date:
                continue
            
            days_until_due = (due_date - today).days
            
            # Check if we should send notification (10 days before OR 3 days to due date)
            should_notify = False
            if days_until_due == 10:
                should_notify = True
            elif 0 <= days_until_due <= 3:
                should_notify = True
            
            if should_notify:
                notification_key = f"payment_{payment['id']}_{today.isoformat()}"
                
                # Check if notification was already sent today
                existing = await db.notifications.find_one({
                    "related_data.notification_key": notification_key
                })
                
                if not existing:
                    # Send notification to ATHLETE
                    if athlete_user:
                        athlete_notification = {
                            "id": str(uuid.uuid4()),
                            "title": f"Pagamento in scadenza - {payment['month']}",
                            "message": f"Il pagamento di €{payment['amount']} per {payment['month']} scade tra {days_until_due} giorni ({payment['due_date']}). Contatta il tuo coach." if days_until_due > 0 else f"Il pagamento di €{payment['amount']} per {payment['month']} è scaduto il {payment['due_date']}.",
                            "notification_type": "payment_due",
                            "recipient_id": athlete_user["id"],
                            "sender_id": coach_id,
                            "read": False,
                            "related_data": {
                                "payment_id": payment["id"],
                                "athlete_id": athlete["id"],
                                "athlete_name": athlete["name"],
                                "amount": payment["amount"],
                                "month": payment["month"],
                                "due_date": payment["due_date"],
                                "days_until_due": days_until_due,
                                "notification_key": notification_key
                            },
                            "created_at": datetime.utcnow()
                        }
                        await db.notifications.insert_one(athlete_notification)
                    
                    # Send notification to COACH
                    coach_notification = {
                        "id": str(uuid.uuid4()),
                        "title": f"Pagamento atleta in scadenza - {athlete['name']}",
                        "message": f"Il pagamento di {athlete['name']} (€{payment['amount']} - {payment['month']}) scade tra {days_until_due} giorni." if days_until_due > 0 else f"Il pagamento di {athlete['name']} (€{payment['amount']} - {payment['month']}) è scaduto.",
                        "notification_type": "payment_due",
                        "recipient_id": coach_id,
                        "sender_id": None,
                        "read": False,
                        "related_data": {
                            "payment_id": payment["id"],
                            "athlete_id": athlete["id"],
                            "athlete_name": athlete["name"],
                            "amount": payment["amount"],
                            "month": payment["month"],
                            "due_date": payment["due_date"],
                            "days_until_due": days_until_due,
                            "notification_key": f"coach_{notification_key}"
                        },
                        "created_at": datetime.utcnow()
                    }
                    await db.notifications.insert_one(coach_notification)
    
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
        
        # Check payments - show the next due date (from the most recent payment)
        payments = athlete.get("payments", [])
        if payments:
            # Sort payments by due_date to find the most recent one
            def get_payment_date(p):
                d = parse_date_safe(p.get("due_date"))
                return d if d else today
            
            sorted_payments = sorted(payments, key=get_payment_date, reverse=True)
            latest_payment = sorted_payments[0]
            
            due_date = parse_date_safe(latest_payment.get("due_date"))
            if due_date:
                days_until = (due_date - today).days
                # Show warning if payment is upcoming (within 30 days) or overdue
                if days_until <= 30:
                    warnings.append({
                        "type": "payment_due",
                        "athlete_id": athlete["id"],
                        "athlete_name": athlete["name"],
                        "payment_id": latest_payment.get("id"),
                        "month": latest_payment.get("month"),
                        "amount": latest_payment.get("amount"),
                        "due_date": latest_payment.get("due_date"),
                        "paid": latest_payment.get("paid", False),
                        "days_until": days_until,
                        "days_overdue": -days_until if days_until < 0 else 0,
                        "urgent": days_until <= 7 and not latest_payment.get("paid", False)
                    })
    
    return {"warnings": warnings}

# ==================== PAYMENT EXPIRY NOTIFICATIONS ====================

@api_router.post("/check-payment-expiries")
async def check_payment_expiries(current_user: dict = Depends(get_current_user)):
    """
    Check payment due dates and send notifications:
    - 10 days before: First notification to athlete and coach
    - 3 days before until due date: Daily notifications
    """
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can trigger payment checks")
    
    coach_id = current_user["id"]
    today = datetime.utcnow().date()
    notifications_sent = []
    
    # Get all athletes for this coach
    athletes = await db.athletes.find({"coach_id": coach_id}).to_list(length=None)
    
    for athlete in athletes:
        athlete_user = await db.users.find_one({"athlete_id": athlete["id"]})
        
        for payment in athlete.get("payments", []):
            if payment.get("paid"):
                continue  # Skip paid payments
                
            due_date = parse_date_safe(payment.get("due_date"))
            if not due_date:
                continue
            
            days_until_due = (due_date - today).days
            
            # Check if we should send notification
            should_notify = False
            notification_key = f"payment_{payment['id']}_{today.isoformat()}"
            
            if days_until_due == 10:
                # First notification - 10 days before
                should_notify = True
            elif 0 <= days_until_due <= 3:
                # Daily notifications from 3 days before until due date
                should_notify = True
            
            if not should_notify:
                continue
            
            # Check if notification was already sent today
            existing = await db.notifications.find_one({
                "related_data.notification_key": notification_key
            })
            if existing:
                continue
            
            # Determine urgency level
            if days_until_due <= 0:
                urgency = "scaduto"
                urgency_en = "overdue"
            elif days_until_due <= 3:
                urgency = "urgente"
                urgency_en = "urgent"
            else:
                urgency = "promemoria"
                urgency_en = "reminder"
            
            # Create notification for ATHLETE
            if athlete_user:
                athlete_notification = {
                    "id": str(uuid.uuid4()),
                    "title": f"Pagamento in scadenza - {payment['month']}",
                    "message": f"Il pagamento di €{payment['amount']} per {payment['month']} scade tra {days_until_due} giorni ({payment['due_date']}). Contatta il tuo coach per il rinnovo." if days_until_due > 0 else f"Il pagamento di €{payment['amount']} per {payment['month']} è scaduto il {payment['due_date']}. Contatta il tuo coach.",
                    "notification_type": "payment_due",
                    "recipient_id": athlete_user["id"],
                    "sender_id": coach_id,
                    "read": False,
                    "related_data": {
                        "payment_id": payment["id"],
                        "athlete_id": athlete["id"],
                        "athlete_name": athlete["name"],
                        "amount": payment["amount"],
                        "month": payment["month"],
                        "due_date": payment["due_date"],
                        "days_until_due": days_until_due,
                        "urgency": urgency,
                        "notification_key": notification_key
                    },
                    "created_at": datetime.utcnow()
                }
                await db.notifications.insert_one(athlete_notification)
                notifications_sent.append({
                    "type": "athlete",
                    "athlete_name": athlete["name"],
                    "payment_month": payment["month"]
                })
            
            # Create notification for COACH
            coach_notification = {
                "id": str(uuid.uuid4()),
                "title": f"Pagamento atleta in scadenza - {athlete['name']}",
                "message": f"Il pagamento di {athlete['name']} (€{payment['amount']} - {payment['month']}) scade tra {days_until_due} giorni ({payment['due_date']})." if days_until_due > 0 else f"Il pagamento di {athlete['name']} (€{payment['amount']} - {payment['month']}) è scaduto il {payment['due_date']}.",
                "notification_type": "payment_due",
                "recipient_id": coach_id,
                "sender_id": None,
                "read": False,
                "related_data": {
                    "payment_id": payment["id"],
                    "athlete_id": athlete["id"],
                    "athlete_name": athlete["name"],
                    "amount": payment["amount"],
                    "month": payment["month"],
                    "due_date": payment["due_date"],
                    "days_until_due": days_until_due,
                    "urgency": urgency,
                    "notification_key": f"coach_{notification_key}"
                },
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(coach_notification)
            notifications_sent.append({
                "type": "coach",
                "athlete_name": athlete["name"],
                "payment_month": payment["month"]
            })
    
    return {
        "message": f"Controllo completato. {len(notifications_sent)} notifiche inviate.",
        "notifications_sent": notifications_sent
    }

@api_router.get("/payment-expiries")
async def get_payment_expiries(current_user: dict = Depends(get_current_user)):
    """
    Get upcoming payment expiries for dashboard display.
    Returns payments expiring in the next 30 days.
    """
    coach_id = current_user["id"]
    today = datetime.utcnow().date()
    expiries = []
    
    if current_user.get("role") == "coach":
        athletes = await db.athletes.find({"coach_id": coach_id}).to_list(length=None)
    else:
        # Athlete viewing their own expiries
        athlete = await db.athletes.find_one({"id": current_user.get("athlete_id")})
        athletes = [athlete] if athlete else []
    
    for athlete in athletes:
        if not athlete:
            continue
        for payment in athlete.get("payments", []):
            if payment.get("paid"):
                continue
                
            due_date = parse_date_safe(payment.get("due_date"))
            if not due_date:
                continue
            
            days_until_due = (due_date - today).days
            
            if days_until_due <= 30:  # Show expiries within 30 days
                expiries.append({
                    "athlete_id": athlete["id"],
                    "athlete_name": athlete["name"],
                    "payment_id": payment["id"],
                    "month": payment["month"],
                    "amount": payment["amount"],
                    "due_date": payment["due_date"],
                    "days_until_due": days_until_due,
                    "urgency": "overdue" if days_until_due < 0 else "urgent" if days_until_due <= 3 else "warning" if days_until_due <= 10 else "normal"
                })
    
    # Sort by days until due (most urgent first)
    expiries.sort(key=lambda x: x["days_until_due"])
    
    return {"expiries": expiries}

# ==================== STRIPE SUBSCRIPTION ====================

import stripe

# Stripe Price IDs (configurati nel tuo account Stripe)
STRIPE_PRICE_IDS = {
    "monthly": "price_1T957T2MA3CDPbChO6TP49xu",
    "annual": "price_1T958a2MA3CDPbChCHeN5MWx"
}

# Subscription Plans info
SUBSCRIPTION_PLANS = {
    "monthly": {
        "name": "Abbonamento Mensile",
        "amount": 9.99,
        "currency": "eur",
        "interval": "month",
        "price_id": STRIPE_PRICE_IDS["monthly"]
    },
    "annual": {
        "name": "Abbonamento Annuale", 
        "amount": 79.99,
        "currency": "eur",
        "interval": "year",
        "price_id": STRIPE_PRICE_IDS["annual"]
    }
}

class CreateCheckoutRequest(BaseModel):
    plan_id: str  # "monthly" or "annual"
    origin_url: str  # Frontend URL for redirects

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": [
            {
                "id": "monthly",
                "name": SUBSCRIPTION_PLANS["monthly"]["name"],
                "price": SUBSCRIPTION_PLANS["monthly"]["amount"],
                "currency": SUBSCRIPTION_PLANS["monthly"]["currency"],
                "interval": "month",
                "description": "Atleti illimitati, fatturazione mensile"
            },
            {
                "id": "annual",
                "name": SUBSCRIPTION_PLANS["annual"]["name"],
                "price": SUBSCRIPTION_PLANS["annual"]["amount"],
                "currency": SUBSCRIPTION_PLANS["annual"]["currency"],
                "interval": "year",
                "description": "Atleti illimitati, risparmia 2 mesi",
                "savings": "Risparmi €39.89/anno"
            }
        ],
        "free_tier": {
            "athlete_limit": FREE_TIER_ATHLETE_LIMIT,
            "description": f"Gratuito con max {FREE_TIER_ATHLETE_LIMIT} atleta"
        }
    }

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Check if coach has active subscription"""
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can have subscriptions")
    
    coach_id = current_user["id"]
    
    # Check for active subscription
    subscription = await db.subscriptions.find_one({
        "coach_id": coach_id,
        "status": "active",
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    # Count athletes
    athlete_count = await db.athletes.count_documents({"coach_id": coach_id})
    
    if subscription:
        return {
            "is_premium": True,
            "plan": subscription.get("plan_id"),
            "expires_at": subscription.get("expires_at").isoformat() if subscription.get("expires_at") else None,
            "athlete_count": athlete_count,
            "athlete_limit": None,  # Unlimited
            "can_add_athlete": True
        }
    else:
        return {
            "is_premium": False,
            "plan": "free",
            "expires_at": None,
            "athlete_count": athlete_count,
            "athlete_limit": FREE_TIER_ATHLETE_LIMIT,
            "can_add_athlete": athlete_count < FREE_TIER_ATHLETE_LIMIT
        }

@api_router.post("/subscription/checkout")
async def create_checkout_session(request: CreateCheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for subscription using real Stripe Price IDs"""
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can subscribe")
    
    if request.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    plan = SUBSCRIPTION_PLANS[request.plan_id]
    coach_id = current_user["id"]
    coach_email = current_user.get("email", "")
    
    # Get Stripe API key
    stripe_api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Configure Stripe
    stripe.api_key = stripe_api_key
    
    # Build URLs from origin
    success_url = f"{request.origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/subscription/cancel"
    
    try:
        # Create Stripe checkout session with real Price ID
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price": plan["price_id"],
                "quantity": 1
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=coach_email,
            metadata={
                "coach_id": coach_id,
                "coach_email": coach_email,
                "plan_id": request.plan_id,
                "plan_name": plan["name"]
            }
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "coach_id": coach_id,
            "coach_email": coach_email,
            "plan_id": request.plan_id,
            "amount": plan["amount"],
            "currency": plan["currency"],
            "payment_status": "pending",
            "created_at": datetime.utcnow()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Checkout error: {str(e)}")

@api_router.get("/subscription/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get status of checkout session and activate subscription if paid (authenticated)"""
    return await _process_checkout_status(session_id)

@api_router.get("/subscription/verify/{session_id}")
async def verify_checkout_public(session_id: str):
    """Public endpoint to verify and activate subscription after Stripe redirect.
    The session_id itself serves as authentication since only the payer knows it."""
    return await _process_checkout_status(session_id)

async def _process_checkout_status(session_id: str):
    """Internal function to process checkout status"""
    stripe_api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_api_key
    
    try:
        # Get session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Get transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        payment_status = "paid" if session.payment_status == "paid" else "unpaid"
        
        if transaction and payment_status == "paid":
            # Check if already processed
            if transaction.get("payment_status") != "paid":
                # Update transaction
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "paid_at": datetime.utcnow()
                    }}
                )
                
                # Create/update subscription
                plan_id = transaction.get("plan_id")
                coach_id = transaction.get("coach_id")
                
                # Calculate expiration
                if plan_id == "monthly":
                    expires_at = datetime.utcnow() + timedelta(days=30)
                else:  # annual
                    expires_at = datetime.utcnow() + timedelta(days=365)
                
                # Check for existing subscription
                existing = await db.subscriptions.find_one({"coach_id": coach_id})
                
                if existing:
                    # Extend subscription
                    new_expires = max(existing.get("expires_at", datetime.utcnow()), datetime.utcnow())
                    if plan_id == "monthly":
                        new_expires += timedelta(days=30)
                    else:
                        new_expires += timedelta(days=365)
                    
                    await db.subscriptions.update_one(
                        {"coach_id": coach_id},
                        {"$set": {
                            "plan_id": plan_id,
                            "status": "active",
                            "expires_at": new_expires,
                            "updated_at": datetime.utcnow()
                        }}
                    )
                else:
                    # Create new subscription
                    subscription = {
                        "id": str(uuid.uuid4()),
                        "coach_id": coach_id,
                        "plan_id": plan_id,
                        "status": "active",
                        "started_at": datetime.utcnow(),
                        "expires_at": expires_at,
                        "created_at": datetime.utcnow()
                    }
                    await db.subscriptions.insert_one(subscription)
                
                logger.info(f"Subscription activated for coach {coach_id}, plan: {plan_id}")
        
        return {
            "status": session.status,
            "payment_status": payment_status,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "coach_id": transaction.get("coach_id") if transaction else None
        }
    except Exception as e:
        logger.error(f"Checkout status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check error: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription events with signature verification"""
    stripe_api_key = os.environ.get("STRIPE_SECRET_KEY")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    if not stripe_api_key:
        return {"status": "error", "message": "Stripe not configured"}
    
    stripe.api_key = stripe_api_key
    
    try:
        body = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        
        # Verify webhook signature if secret is configured
        if webhook_secret and sig_header:
            try:
                event = stripe.Webhook.construct_event(body, sig_header, webhook_secret)
                logger.info(f"Webhook signature verified for event: {event.type}")
            except stripe.error.SignatureVerificationError as e:
                logger.error(f"Webhook signature verification failed: {str(e)}")
                return {"status": "error", "message": "Invalid signature"}
        else:
            # Fallback without signature verification (dev mode)
            event = stripe.Event.construct_from(json.loads(body), stripe_api_key)
        
        logger.info(f"Webhook received: {event.type}")
        
        # Handle checkout.session.completed
        if event.type == "checkout.session.completed":
            session = event.data.object
            logger.info(f"Processing checkout.session.completed for session: {session.id}")
            
            # Get transaction and update if exists
            transaction = await db.payment_transactions.find_one({"session_id": session.id})
            if transaction:
                payment_status = getattr(session, 'payment_status', None)
                logger.info(f"Transaction found, payment_status: {payment_status}")
                
                if payment_status == "paid":
                    await db.payment_transactions.update_one(
                        {"session_id": session.id},
                        {"$set": {"payment_status": "paid", "paid_at": datetime.utcnow()}}
                    )
                    
                    # Activate subscription
                    plan_id = transaction.get("plan_id")
                    coach_id = transaction.get("coach_id")
                    
                    if plan_id == "monthly":
                        expires_at = datetime.utcnow() + timedelta(days=30)
                    else:
                        expires_at = datetime.utcnow() + timedelta(days=365)
                    
                    existing = await db.subscriptions.find_one({"coach_id": coach_id})
                    if existing:
                        new_expires = max(existing.get("expires_at", datetime.utcnow()), datetime.utcnow())
                        new_expires += timedelta(days=30) if plan_id == "monthly" else timedelta(days=365)
                        await db.subscriptions.update_one(
                            {"coach_id": coach_id},
                            {"$set": {"plan_id": plan_id, "status": "active", "expires_at": new_expires, "updated_at": datetime.utcnow()}}
                        )
                    else:
                        await db.subscriptions.insert_one({
                            "id": str(uuid.uuid4()),
                            "coach_id": coach_id,
                            "plan_id": plan_id,
                            "status": "active",
                            "started_at": datetime.utcnow(),
                            "expires_at": expires_at,
                            "created_at": datetime.utcnow()
                        })
                    
                    logger.info(f"Subscription activated via webhook for coach: {coach_id}, plan: {plan_id}")
            else:
                logger.warning(f"No transaction found for session: {session.id}")
        
        # Handle subscription cancellation
        elif event.type == "customer.subscription.deleted":
            subscription = event.data.object
            customer_email = subscription.get("customer_email", "")
            
            # Find coach by email and deactivate
            user = await db.users.find_one({"email": customer_email})
            if user:
                await db.subscriptions.update_one(
                    {"coach_id": user["id"]},
                    {"$set": {"status": "canceled", "updated_at": datetime.utcnow()}}
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

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
