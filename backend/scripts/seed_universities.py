"""Seed universities table with common Indian universities for demo."""

import uuid
from app.database import SessionLocal
from app.models.university import University


UNIVERSITIES = [
    {
        "name": "Indian Institute of Technology Bombay",
        "city": "Mumbai",
        "state": "Maharashtra",
    },
    {
        "name": "Indian Institute of Technology Delhi",
        "city": "New Delhi",
        "state": "Delhi",
    },
    {
        "name": "Indian Institute of Technology Madras",
        "city": "Chennai",
        "state": "Tamil Nadu",
    },
    {
        "name": "Indian Institute of Technology Kharagpur",
        "city": "Kharagpur",
        "state": "West Bengal",
    },
    {
        "name": "Indian Institute of Technology Kanpur",
        "city": "Kanpur",
        "state": "Uttar Pradesh",
    },
    {
        "name": "Indian Institute of Technology Roorkee",
        "city": "Roorkee",
        "state": "Uttarakhand",
    },
    {
        "name": "Indian Institute of Technology Hyderabad",
        "city": "Hyderabad",
        "state": "Telangana",
    },
    {
        "name": "Indian Institute of Technology Gandhinagar",
        "city": "Gandhinagar",
        "state": "Gujarat",
    },
    {
        "name": "National Institute of Technology Trichy",
        "city": "Tiruchirappalli",
        "state": "Tamil Nadu",
    },
    {
        "name": "National Institute of Technology Warangal",
        "city": "Warangal",
        "state": "Telangana",
    },
    {
        "name": "National Institute of Technology Surathkal",
        "city": "Mangaluru",
        "state": "Karnataka",
    },
    {
        "name": "Birla Institute of Technology and Science Pilani",
        "city": "Pilani",
        "state": "Rajasthan",
    },
    {
        "name": "Vellore Institute of Technology",
        "city": "Vellore",
        "state": "Tamil Nadu",
    },
    {
        "name": "Manipal Institute of Technology",
        "city": "Manipal",
        "state": "Karnataka",
    },
    {"name": "Delhi Technological University", "city": "New Delhi", "state": "Delhi"},
    {
        "name": "Netaji Subhas University of Technology",
        "city": "New Delhi",
        "state": "Delhi",
    },
    {"name": "Jadavpur University", "city": "Kolkata", "state": "West Bengal"},
    {"name": "Anna University", "city": "Chennai", "state": "Tamil Nadu"},
    {
        "name": "Pune Institute of Computer Technology",
        "city": "Pune",
        "state": "Maharashtra",
    },
    {"name": "College of Engineering Pune", "city": "Pune", "state": "Maharashtra"},
    {"name": "Test University", "city": "Hyderabad", "state": "Telangana"},
]


def main():
    db: SessionLocal = SessionLocal()
    try:
        existing = {u.name for u in db.query(University.name).all()}
        added = 0
        for u in UNIVERSITIES:
            if u["name"] not in existing:
                db.add(
                    University(
                        id=uuid.uuid4(),
                        name=u["name"],
                        city=u["city"],
                        state=u["state"],
                        country="India",
                    )
                )
                added += 1
        db.commit()
        print(
            f"Seeded {added} universities ({len(UNIVERSITIES) - added} already existed)."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
