import asyncio
from sqlalchemy import select
from src.database import get_session, dispose_engine
from src.models import Group

async def check():
    async with get_session() as session:
        g = await session.get(Group, 69)
        print(f"Group 69 exists: {g is not None}")
        if g:
            print(f"Approved: {g.is_approved}")
        
        stmt = select(Group)
        all_groups = (await session.scalars(stmt)).all()
        print(f"Total groups: {len(all_groups)}")
        if all_groups:
             print("First 5 groups IDs:", [grp.id for grp in all_groups[:5]])

async def main():
    try:
        await check()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
