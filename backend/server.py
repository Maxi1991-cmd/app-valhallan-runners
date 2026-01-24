from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    coach_id: Optional[str] = None  # For athletes, links to their coach

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    coach_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

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
    notification_type: str  # payment_due, certificate_expiry, message, reminder

class NotificationCreate(NotificationBase):
    recipient_id: str

class Notification(NotificationBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    recipient_id: str
    read: bool = False
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
    source: str = "manual"  # manual, garmin, polar, suunto, strava, fitbit
    raw_data: Optional[dict] = None
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

# ==================== AUTH ROUTES ====================

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
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user_dict["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            name=user_dict["name"],
            role=user_dict["role"],
            coach_id=user_dict.get("coach_id")
        )
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            coach_id=user.get("coach_id")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        coach_id=current_user.get("coach_id")
    )

# ==================== ATHLETE PROFILE ROUTES ====================

@api_router.post("/athletes", response_model=AthleteProfile)
async def create_athlete(athlete: AthleteProfileCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create athletes")
    
    athlete_dict = athlete.dict()
    athlete_dict["id"] = str(uuid.uuid4())
    athlete_dict["coach_id"] = current_user["id"]
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
async def update_athlete(athlete_id: str, update: AthleteProfileUpdate, current_user: dict = Depends(get_current_user)):
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
async def delete_athlete(athlete_id: str, current_user: dict = Depends(get_current_user)):
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
async def create_program(program: TrainingProgramCreate, current_user: dict = Depends(get_current_user)):
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
async def update_program(program_id: str, update: TrainingProgramUpdate, current_user: dict = Depends(get_current_user)):
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
async def delete_program(program_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can delete programs")
    
    program = await db.programs.find_one({"id": program_id})
    if not program or program["coach_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Program not found")
    
    await db.programs.delete_one({"id": program_id})
    return {"message": "Program deleted successfully"}

# ==================== WORKOUT COMPLETION ====================

@api_router.put("/programs/{program_id}/workouts/{workout_id}/complete")
async def complete_workout(program_id: str, workout_id: str, actual_data: Optional[dict] = None, current_user: dict = Depends(get_current_user)):
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    completed_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    await db.programs.update_one(
        {"id": program_id, "workouts.id": workout_id},
        {"$set": {
            "workouts.$.completed": True,
            "workouts.$.completed_date": completed_date,
            "workouts.$.actual_data": actual_data
        }}
    )
    
    return {"message": "Workout marked as complete"}

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
    
    return [Notification(**n) for n in notifications]

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

# ==================== ANALYTICS ROUTES ====================

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

# ==================== EXPIRY CHECK ROUTES ====================

@api_router.get("/check-expiries")
async def check_expiries(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can check expiries")
    
    athletes = await db.athletes.find({"coach_id": current_user["id"]}).to_list(1000)
    
    warnings = []
    today = datetime.utcnow().date()
    
    for athlete in athletes:
        # Check medical certificate
        cert = athlete.get("medical_certificate", {})
        if cert.get("expiry_date"):
            expiry = datetime.strptime(cert["expiry_date"], "%Y-%m-%d").date()
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
                due_date = datetime.strptime(payment["due_date"], "%Y-%m-%d").date()
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
