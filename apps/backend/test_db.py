import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://safecity:safecity_pass@localhost:5432/safecitydb')
    try:
        val = await conn.fetchval('SELECT version();')
        print(f"Version: {val}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(main())
