from pydantic import BaseModel, EmailStr, field_validator
from typing import Dict, List, Optional, Literal
from datetime import datetime, date
from .models import UserRole, AgencyApplicationStatus, NotificationType, MessageSenderRole
import json

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.USER
    phone_number: Optional[str] = None
    country: Optional[str] = None

class UserCreate(UserBase):
    password: str
    language: Optional[str] = None

class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_verified: Optional[bool] = None
    is_email_verified: Optional[bool] = None
    is_phone_verified: Optional[bool] = None
    onboarding_completed: Optional[bool] = None
    agency_id: Optional[int] = None

class AdminCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class UserVerifyEmail(BaseModel):
    email: EmailStr
    code: str

class UserVerifyPhone(BaseModel):
    email: EmailStr
    code: str

class UserRequestVerification(BaseModel):
    email: EmailStr
    language: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    time_zone: Optional[str] = None
    avatar_url: Optional[str] = None

class UserEmailChangeRequest(BaseModel):
    new_email: EmailStr
    language: Optional[str] = None

class UserRequestPhoneVerification(BaseModel):
    email: EmailStr
    language: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    language: Optional[str] = None

class ForgotPasswordByPhoneRequest(BaseModel):
    phone_number: str
    language: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ResetPasswordByPhoneRequest(BaseModel):
    phone_number: str
    code: str
    new_password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str

class UserOnboarding(BaseModel):
    preferred_destinations: List[str] = []
    budget_range: Optional[str] = None
    travel_style: Optional[str] = None
    interests: List[str] = []

class User(UserBase):
    id: int
    created_at: datetime
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    time_zone: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = None
    is_verified: bool = False
    is_email_verified: bool = False
    is_phone_verified: bool = False
    onboarding_completed: bool = False
    is_banned: bool = False
    banned_until: Optional[datetime] = None
    banned_reason: Optional[str] = None
    agency_id: Optional[int] = None
    pending_email: Optional[EmailStr] = None
    last_login_at: Optional[datetime] = None
    preferred_destinations: Optional[List[str]] = None
    budget_range: Optional[str] = None
    travel_style: Optional[str] = None
    interests: Optional[List[str]] = None

    @field_validator("preferred_destinations", "interests", mode="before")
    @classmethod
    def _parse_json_list(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else None
            except Exception:
                return None
        return None

    class Config:
        from_attributes = True

class AdminUserOverview(BaseModel):
    total_users: int
    verified_users: int
    new_registrations_7d: int
    recent_users: List[User]

class UserSession(BaseModel):
    session_id: str
    auth_provider: Optional[str] = None
    device_label: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    last_seen_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    is_current: bool = False

    class Config:
        from_attributes = True

# Agency Schemas
class AgencyBase(BaseModel):
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None

class AgencyCreate(AgencyBase):
    pass

class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    office_address: Optional[str] = None
    tax_vat_info: Optional[str] = None
    status: Optional[str] = None
    subscription_status: Optional[str] = None
    custom_trip_requests_enabled: Optional[bool] = None
    countries_served: Optional[str] = None
    cities_served: Optional[str] = None

class Agency(AgencyBase):
    id: int
    phone_number: Optional[str] = None
    country: Optional[str] = None
    office_address: Optional[str] = None
    tax_vat_info: Optional[str] = None
    status: Optional[str] = None
    subscription_status: Optional[str] = None
    custom_trip_requests_enabled: Optional[bool] = None
    countries_served: Optional[str] = None
    cities_served: Optional[str] = None

    class Config:
        from_attributes = True

class AgencyAvailability(BaseModel):
    id: int
    agency_id: int
    date: date
    is_blocked: bool
    capacity_override: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AgencyAvailabilityUpsertRequest(BaseModel):
    date: str
    is_blocked: Optional[bool] = None
    capacity_override: Optional[int] = None

class AgencyTeamMember(BaseModel):
    id: int
    agency_id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class AgencyTeamMemberCreateRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "staff"

class AgencyCustomerSummary(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    email: EmailStr
    bookings_count: int
    total_spent: float

class AgencyAnalytics(BaseModel):
    total_packages: int
    bookings_total: int
    bookings_pending: int
    bookings_payment_pending: int
    bookings_confirmed: int
    bookings_in_progress: int
    bookings_completed: int
    revenue_total: float

class AgencyReviewItem(BaseModel):
    id: int
    package_id: int
    package_title: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    user: Optional["UserPublic"] = None

class AgencyApplication(BaseModel):
    id: int
    user_id: int
    agency_id: Optional[int] = None
    agency_name: str
    company_email: EmailStr
    phone_number: str
    country: str
    office_address: str
    website: Optional[str] = None
    tax_vat_info: str
    business_license_path: Optional[str] = None
    tourism_certificate_path: Optional[str] = None
    id_verification_path: Optional[str] = None
    status: AgencyApplicationStatus
    rejection_reason: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminLoginStartRequest(BaseModel):
    email: EmailStr
    password: str
    language: Optional[str] = None
    remember_me: bool = False

class AdminLoginStartResponse(BaseModel):
    two_factor_required: bool = True

class AdminVerify2FARequest(BaseModel):
    email: EmailStr
    code: str
    remember_me: bool = False

class AdminImpersonateRequest(BaseModel):
    role: str

class SocialLoginRequest(BaseModel):
    provider: str
    email: EmailStr
    full_name: Optional[str] = None
    remember_me: bool = False

class Notification(BaseModel):
    id: int
    type: NotificationType
    title: str
    body: Optional[str] = None
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationMarkReadRequest(BaseModel):
    notification_ids: List[int]

class Favorite(BaseModel):
    id: int
    package_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class FavoriteCreateRequest(BaseModel):
    package_id: int

class Conversation(BaseModel):
    id: int
    user_id: int
    agency_id: int
    package_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConversationCreateRequest(BaseModel):
    agency_id: int
    package_id: Optional[int] = None

class Message(BaseModel):
    id: int
    conversation_id: int
    sender_role: MessageSenderRole
    sender_user_id: Optional[int] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class MessageCreateRequest(BaseModel):
    content: str

# Package Schemas
CurrencyCode = Literal["AZN", "USD", "EUR", "RUB", "TRY"]
PricingMode = Literal["auto", "manual"]
PackageStatus = Literal["draft", "active", "expired", "archived"]


def _coerce_string_list(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            value = json.loads(raw)
        except Exception:
            return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]
    return []

class PackageBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    pricing_mode: Optional[PricingMode] = "auto"
    base_currency: Optional[CurrencyCode] = "USD"
    prices: Optional[Dict[CurrencyCode, float]] = None
    destination: str
    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    package_type: Optional[str] = None
    hotel_rating: Optional[int] = None
    transportation_type: Optional[str] = None
    duration_days: int
    capacity: int
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    highlights: Optional[List[str]] = None
    category: Optional[str] = None
    status: Optional[PackageStatus] = "active"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    agency_id: int

    @field_validator("highlights", mode="before")
    @classmethod
    def _parse_highlights(cls, v):
        return _coerce_string_list(v)

class PackageCreate(PackageBase):
    pass

class Package(PackageBase):
    id: int
    agency: Optional[Agency] = None
    archived_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("prices", mode="before")
    @classmethod
    def _parse_prices(cls, v):
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
        return None

    @field_validator("highlights", mode="before")
    @classmethod
    def _serialize_highlights(cls, v):
        return _coerce_string_list(v)

    class Config:
        from_attributes = True

class PackageStatusUpdateRequest(BaseModel):
    status: PackageStatus
    reason: Optional[str] = None

class PackageDuplicateRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[PackageStatus] = "draft"

# Booking Schemas
class BookingBase(BaseModel):
    package_id: int
    travel_date: datetime
    number_of_people: int
    additional_requests: Optional[str] = None
    currency: Optional[CurrencyCode] = None

class BookingCreate(BookingBase):
    pass

class Booking(BookingBase):
    id: int
    user_id: int
    total_price: float
    offered_total_price: Optional[float] = None
    booking_date: datetime
    status: str
    payment_status: Optional[str] = None
    payment_reference: Optional[str] = None
    more_info_message: Optional[str] = None
    offer_message: Optional[str] = None
    offer_sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    package: Optional[Package] = None

    class Config:
        from_attributes = True

class BookingPaymentInitiateRequest(BookingBase):
    pass

class BookingPaymentInitiateResponse(BaseModel):
    booking: Booking
    payment_url: str

    class Config:
        from_attributes = True

class BookingRequestMoreInfoRequest(BaseModel):
    message: str

class BookingChangePriceRequest(BaseModel):
    offered_total_price: float
    message: Optional[str] = None

class BookingSendOfferRequest(BaseModel):
    offered_total_price: Optional[float] = None
    message: Optional[str] = None

class BookingAdminSetStatusRequest(BaseModel):
    status: str
    note: Optional[str] = None

# Review Schemas
class ReviewBase(BaseModel):
    package_id: int
    rating: int
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class Review(ReviewBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserPublic(BaseModel):
    id: int
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class ReviewWithUser(Review):
    user: Optional[UserPublic] = None

# Community Schemas
class CommunityPostCreateRequest(BaseModel):
    title: str
    body: str
    tag: Optional[str] = None
    kind: Optional[str] = "story"
    image_url: Optional[str] = None
    images: Optional[List[str]] = None

class CommunityPostUpdateRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    tag: Optional[str] = None
    kind: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None

class CommunityPost(BaseModel):
    id: int
    user_id: int
    title: str
    body: str
    tag: Optional[str] = None
    kind: str
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    likes_count: int
    comments_count: int
    shares_count: int
    is_hidden: bool = False
    status: Optional[str] = None
    moderation_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserPublic] = None
    liked: Optional[bool] = None
    bookmarked: Optional[bool] = None

    @field_validator("images", mode="before")
    @classmethod
    def _parse_images_json(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else None
            except Exception:
                return None
        return None

    class Config:
        from_attributes = True

class CommunityCommentCreateRequest(BaseModel):
    body: str

class CommunityCommentUpdateRequest(BaseModel):
    body: str

class CommunityReportRequest(BaseModel):
    reason: Optional[str] = None

class CommunityComment(BaseModel):
    id: int
    post_id: int
    user_id: int
    body: str
    is_hidden: bool = False
    status: Optional[str] = None
    moderation_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserPublic] = None

    class Config:
        from_attributes = True

# Blog Schemas
class BlogArticleSummary(BaseModel):
    id: int
    slug: str
    title: str
    excerpt: str
    category: Optional[str] = None
    author_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    reading_minutes: int
    published_at: datetime

    class Config:
        from_attributes = True

class BlogArticle(BlogArticleSummary):
    content: str

class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    language: Optional[str] = None

class NewsletterSubscriber(BaseModel):
    id: int
    email: EmailStr
    language: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ModerationLog(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    user_id: Optional[int] = None
    reporter_user_id: Optional[int] = None
    reason: str
    note: Optional[str] = None
    action: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_user_id: Optional[int] = None

    class Config:
        from_attributes = True

class ModerationCommunityPostDecisionRequest(BaseModel):
    action: Literal["approve", "reject", "needs_revision", "hide"]
    note: Optional[str] = None

class ModerationUserBanRequest(BaseModel):
    reason: Optional[str] = None
    duration_days: Optional[int] = None

class TripRequestCreateRequest(BaseModel):
    destination: str
    destination_type: Literal["any", "country", "city"] = "any"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    flexible_dates: bool = False
    adults: int = 1
    children: int = 0
    ideal_budget: float
    max_budget: Optional[float] = None
    budget_currency: str = "USD"
    budget_flexibility: Literal["fixed", "flexible_10", "flexible_20", "no_budget_limit"] = "fixed"
    hotel_stars: Optional[int] = None
    meal_type: Optional[str] = None
    flight_included: bool = False
    transfer_included: bool = False
    visa_assistance: bool = False
    travel_insurance: bool = False
    preferred_airline: Optional[str] = None
    accommodation_preferences: Optional[str] = None
    activities_interests: Optional[str] = None
    special_notes: Optional[str] = None
    offer_expiration_hours: Literal[24, 48, 72] = 48

class TripRequest(BaseModel):
    id: int
    request_code: str
    user_id: int
    destination: str
    destination_type: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    flexible_dates: bool
    adults: int
    children: int
    ideal_budget: float
    max_budget: Optional[float] = None
    budget_currency: str
    budget_flexibility: str
    hotel_stars: Optional[int] = None
    meal_type: Optional[str] = None
    flight_included: bool
    transfer_included: bool
    visa_assistance: bool
    travel_insurance: bool
    preferred_airline: Optional[str] = None
    accommodation_preferences: Optional[str] = None
    activities_interests: Optional[str] = None
    special_notes: Optional[str] = None
    offer_expiration_hours: int
    expires_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TripRequestAgencyMatch(BaseModel):
    id: int
    trip_request_id: int
    agency_id: int
    status: str
    declined_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TripOfferCreateRequest(BaseModel):
    total_price: float
    currency: str = "USD"
    hotel: Optional[str] = None
    room_type: Optional[str] = None
    meal_plan: Optional[str] = None
    flight: Optional[str] = None
    transfer: Optional[str] = None
    visa: Optional[str] = None
    insurance: Optional[str] = None
    activities: Optional[str] = None
    offer_description: Optional[str] = None
    additional_benefits: Optional[str] = None
    offer_expiration_hours: Optional[int] = None
    price_difference_reason: Optional[str] = None
    price_difference_notes: Optional[str] = None

class TripOffer(BaseModel):
    id: int
    trip_request_id: int
    agency_id: int
    created_by_user_id: int
    total_price: float
    currency: str
    hotel: Optional[str] = None
    room_type: Optional[str] = None
    meal_plan: Optional[str] = None
    flight: Optional[str] = None
    transfer: Optional[str] = None
    visa: Optional[str] = None
    insurance: Optional[str] = None
    activities: Optional[str] = None
    offer_description: Optional[str] = None
    additional_benefits: Optional[str] = None
    price_difference_reason: Optional[str] = None
    price_difference_notes: Optional[str] = None
    expires_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime
    accepted_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TripBooking(BaseModel):
    id: int
    trip_request_id: int
    trip_offer_id: int
    user_id: int
    agency_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TripOfferMessageCreateRequest(BaseModel):
    content: str

class TripOfferMessage(BaseModel):
    id: int
    trip_request_id: int
    trip_offer_id: Optional[int] = None
    user_id: int
    agency_id: int
    sender_role: str
    sender_user_id: Optional[int] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class TripOfferNotification(BaseModel):
    id: int
    recipient_user_id: int
    trip_request_id: Optional[int] = None
    trip_offer_id: Optional[int] = None
    type: str
    title: str
    body: Optional[str] = None
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class OfferComparison(BaseModel):
    id: int
    trip_request_id: int
    trip_offer_id: int
    ideal_budget: float
    max_budget: Optional[float] = None
    offer_price: float
    budget_status: str
    delta_from_ideal: Optional[float] = None
    delta_from_max: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
