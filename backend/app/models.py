from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import datetime
import enum

class UserRole(enum.Enum):
    USER = "user"
    ADMIN = "admin"
    AGENCY = "agency"

class AgencyApplicationStatus(enum.Enum):
    PENDING = "pending_verification"
    APPROVED = "approved"
    REJECTED = "rejected"

class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PAYMENT_PENDING = "payment_pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUND_REQUESTED = "refund_requested"
    REFUNDED = "refunded"
    DISPUTED = "disputed"

class MessageSenderRole(str, enum.Enum):
    USER = "user"
    AGENCY = "agency"
    ADMIN = "admin"

class NotificationType(str, enum.Enum):
    BOOKING = "booking"
    MESSAGE = "message"
    SYSTEM = "system"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    agency_id = Column(Integer, ForeignKey("agencies.id"), nullable=True)
    admin_2fa_code_hash = Column(String, nullable=True)
    admin_2fa_expires_at = Column(DateTime, nullable=True)
    admin_2fa_sent_at = Column(DateTime, nullable=True)
    admin_2fa_rate_window_start = Column(DateTime, nullable=True)
    admin_2fa_rate_count = Column(Integer, default=0)
    phone_number = Column(String, nullable=True, index=True)
    country = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)
    preferred_destinations = Column(Text, nullable=True)
    budget_range = Column(String, nullable=True)
    travel_style = Column(String, nullable=True)
    interests = Column(Text, nullable=True)
    verification_code = Column(String, nullable=True)
    verification_code_hash = Column(String, nullable=True)
    verification_expires_at = Column(DateTime, nullable=True)
    verification_sent_at = Column(DateTime, nullable=True)
    verification_rate_window_start = Column(DateTime, nullable=True)
    verification_rate_count = Column(Integer, default=0)
    phone_verification_code_hash = Column(String, nullable=True)
    phone_verification_expires_at = Column(DateTime, nullable=True)
    phone_verification_sent_at = Column(DateTime, nullable=True)
    phone_verification_rate_window_start = Column(DateTime, nullable=True)
    phone_verification_rate_count = Column(Integer, default=0)
    password_reset_token_hash = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    password_reset_sent_at = Column(DateTime, nullable=True)
    password_reset_rate_window_start = Column(DateTime, nullable=True)
    password_reset_rate_count = Column(Integer, default=0)
    is_banned = Column(Boolean, default=False)
    banned_until = Column(DateTime, nullable=True)
    banned_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    bookings = relationship("Booking", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    agency = relationship("Agency", back_populates="users")
    agency_applications = relationship("AgencyApplication", back_populates="user", foreign_keys="AgencyApplication.user_id")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")

class Agency(Base):
    __tablename__ = "agencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    website = Column(String)
    contact_email = Column(String)
    phone_number = Column(String, nullable=True, index=True)
    country = Column(String, nullable=True)
    office_address = Column(String, nullable=True)
    tax_vat_info = Column(String, nullable=True)
    status = Column(String, default="inactive")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    packages = relationship("Package", back_populates="agency")
    users = relationship("User", back_populates="agency")
    applications = relationship("AgencyApplication", back_populates="agency")
    availability_entries = relationship("AgencyAvailability", back_populates="agency", cascade="all, delete-orphan")
    team_members = relationship("AgencyTeamMember", back_populates="agency", cascade="all, delete-orphan")

class AgencyApplication(Base):
    __tablename__ = "agency_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agency_id = Column(Integer, ForeignKey("agencies.id"), nullable=True)

    agency_name = Column(String, nullable=False)
    company_email = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    country = Column(String, nullable=False)
    office_address = Column(String, nullable=False)
    website = Column(String, nullable=True)
    tax_vat_info = Column(String, nullable=False)

    business_license_path = Column(String, nullable=True)
    tourism_certificate_path = Column(String, nullable=True)
    id_verification_path = Column(String, nullable=True)

    status = Column(Enum(AgencyApplicationStatus), default=AgencyApplicationStatus.PENDING)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="agency_applications")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])
    agency = relationship("Agency", back_populates="applications")

class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False, index=True)
    status = Column(String, default="active", index=True)
    pricing_mode = Column(String, default="auto")
    base_currency = Column(String, default="USD")
    prices = Column(Text, nullable=True)
    destination = Column(String, index=True)
    country = Column(String, index=True, nullable=True)
    city = Column(String, index=True, nullable=True)
    region = Column(String, index=True, nullable=True)
    package_type = Column(String, index=True, nullable=True)
    hotel_rating = Column(Integer, index=True, nullable=True)
    transportation_type = Column(String, index=True, nullable=True)
    duration_days = Column(Integer)
    capacity = Column(Integer)
    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True, index=True)
    archived_at = Column(DateTime, nullable=True, index=True)
    image_url = Column(String)
    images = Column(Text)
    highlights = Column(Text)
    category = Column(String, index=True)
    agency_id = Column(Integer, ForeignKey("agencies.id"), index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    agency = relationship("Agency", back_populates="packages")
    bookings = relationship("Booking", back_populates="package")
    reviews = relationship("Review", back_populates="package")

class PackageStatusLog(Base):
    __tablename__ = "package_status_logs"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, index=True)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)

    package = relationship("Package")
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])

class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    tag = Column(String, nullable=True, index=True)
    kind = Column(String, default="story")
    image_url = Column(String, nullable=True)
    images = Column(Text, nullable=True)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    is_hidden = Column(Boolean, default=False)
    status = Column(String, default="approved", index=True)
    moderation_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])
    comments = relationship("CommunityComment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("CommunityPostLike", back_populates="post", cascade="all, delete-orphan")
    bookmarks = relationship("CommunityPostBookmark", back_populates="post", cascade="all, delete-orphan")

class CommunityComment(Base):
    __tablename__ = "community_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=False)
    status = Column(String, default="approved", index=True)
    moderation_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    post = relationship("CommunityPost", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])

class CommunityPostLike(Base):
    __tablename__ = "community_post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    post = relationship("CommunityPost", back_populates="likes")

class CommunityPostBookmark(Base):
    __tablename__ = "community_post_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    post = relationship("CommunityPost", back_populates="bookmarks")

class BlogArticle(Base):
    __tablename__ = "blog_articles"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    excerpt = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    title_i18n = Column(Text, nullable=True)
    excerpt_i18n = Column(Text, nullable=True)
    content_i18n = Column(Text, nullable=True)
    category = Column(String, index=True, nullable=True)
    author_name = Column(String, nullable=True)
    cover_image_url = Column(String, nullable=True)
    reading_minutes = Column(Integer, default=6)
    published_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    is_published = Column(Boolean, default=True)

class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    language = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, index=True, nullable=False)
    entity_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reason = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    action = Column(String, default="hidden")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    reporter = relationship("User", foreign_keys=[reporter_user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    package_id = Column(Integer, ForeignKey("packages.id"))
    booking_date = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    travel_date = Column(DateTime)
    number_of_people = Column(Integer)
    total_price = Column(Float)
    currency = Column(String, nullable=True)
    offered_total_price = Column(Float, nullable=True)
    additional_requests = Column(Text, nullable=True)
    more_info_message = Column(Text, nullable=True)
    offer_message = Column(Text, nullable=True)
    offer_sent_at = Column(DateTime, nullable=True)
    payment_status = Column(String, default="none")
    payment_reference = Column(String, nullable=True)
    status = Column(String, default=BookingStatus.PENDING.value)
    accepted_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="bookings")
    package = relationship("Package", back_populates="bookings")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    package_id = Column(Integer, ForeignKey("packages.id"))
    rating = Column(Integer)
    comment = Column(Text)
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="reviews")
    package = relationship("Package", back_populates="reviews")

class AgencyAvailability(Base):
    __tablename__ = "agency_availability"

    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(Integer, ForeignKey("agencies.id"), index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    is_blocked = Column(Boolean, default=False)
    capacity_override = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    agency = relationship("Agency", back_populates="availability_entries")

class AgencyTeamMember(Base):
    __tablename__ = "agency_team_members"

    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(Integer, ForeignKey("agencies.id"), index=True, nullable=False)
    email = Column(String, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="staff")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    agency = relationship("Agency", back_populates="team_members")

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="favorites")
    package = relationship("Package")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    agency_id = Column(Integer, ForeignKey("agencies.id"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="conversations")
    agency = relationship("Agency")
    package = relationship("Package")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_role = Column(Enum(MessageSenderRole), nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    conversation = relationship("Conversation", back_populates="messages")
    sender_user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(Enum(NotificationType), default=NotificationType.SYSTEM)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    link_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="notifications")

class AuthDeliveryLog(Base):
    __tablename__ = "auth_delivery_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    channel = Column(String, nullable=False, index=True)
    purpose = Column(String, nullable=False, index=True)
    recipient = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    status = Column(String, nullable=False, index=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)

    user = relationship("User", foreign_keys=[user_id])
