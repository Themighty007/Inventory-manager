from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.database.connection import engine, SessionLocal, Base
from backend.app.database.models import Drawer


def migrate_database():
    """Idempotently add any new columns to existing SQLite tables without losing existing data."""
    required_columns = {
        "stock_lots": [
            ("order_date", "DATETIME"),
            ("delivery_arrival_time", "DATETIME"),
        ],
        "parcels": [
            ("order_date", "DATETIME"),
            ("delivery_arrival_time", "DATETIME"),
        ],
        "invoices": [
            ("sale_order_number", "VARCHAR(100)"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("tax_amount", "FLOAT DEFAULT 0.0"),
            ("currency", "VARCHAR(10) DEFAULT 'INR'"),
            ("order_date", "DATETIME"),
            ("delivery_arrival_time", "DATETIME"),
            ("source_filename", "VARCHAR(255)"),
            ("notes", "TEXT"),
            ("created_at", "DATETIME"),
        ],
        "invoice_items": [
            ("item_name", "VARCHAR(255)"),
            ("drawer_id", "VARCHAR(10)"),
            ("hsn_code", "VARCHAR(30)"),
            ("tax_rate", "FLOAT DEFAULT 0.0"),
            ("line_total", "FLOAT DEFAULT 0.0"),
            ("status", "VARCHAR(30) DEFAULT 'LOGGED'"),
        ],
        "inventory_transactions": [
            ("order_date", "DATETIME"),
            ("delivery_arrival_time", "DATETIME"),
        ],
    }

    with engine.begin() as conn:
        for table_name, columns in required_columns.items():
            existing = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            }
            for col_name, col_type in columns:
                if col_name not in existing:
                    conn.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                    )


def seed_database():
    Base.metadata.create_all(bind=engine)
    migrate_database()
    db: Session = SessionLocal()

    try:
        # 1. Seed 39 Stanley 1-93-981 Drawers if empty
        if db.query(Drawer).count() == 0:
            drawers = []
            # Upper Section: 30 Small Drawers (5 rows x 6 cols)
            for row in range(1, 6):
                for col in range(1, 7):
                    num = (row - 1) * 6 + col
                    drawer_id = f"S{num:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="UPPER",
                            drawer_type="SMALL",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 5.0 x 3.5 cm",
                            max_sub_trays=3,
                        )
                    )

            # Lower Section: 9 Large Drawers (3 rows x 3 cols)
            for row in range(1, 4):
                for col in range(1, 4):
                    num = (row - 1) * 3 + col
                    drawer_id = f"L{num:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="LOWER",
                            drawer_type="LARGE",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 11.0 x 6.0 cm",
                            max_sub_trays=4,
                        )
                    )

            db.add_all(drawers)
            db.commit()
    except Exception:
        db.rollback()
        # Concurrency safe: if already seeded by sibling thread, ignore
    finally:
        db.close()
