import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'safecitydb';"))
        for row in res.all():
            print(f"Database: {row[0]}, Owner: {row[1]}")
            
        res = await conn.execute(text("SELECT current_user, session_user;"))
        row = res.fetchone()
        print(f"Current User: {row[0]}, Session User: {row[1]}")

if __name__ == "__main__":
    asyncio.run(main())
