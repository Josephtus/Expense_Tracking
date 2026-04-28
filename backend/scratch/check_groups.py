import asyncio
from src.database import get_session
from src.models import Group, GroupMember, Expense
from sqlalchemy import select, func

async def check():
    async with get_session() as session:
        user_id = 1 # Varsayılan test user id
        
        last_exp_sub = (
            select(Expense.group_id, func.max(Expense.created_at).label("last_act"))
            .where(Expense.is_deleted.is_(False))
            .group_by(Expense.group_id)
            .subquery()
        )
        
        stmt = (
            select(Group, GroupMember)
            .join(GroupMember, (GroupMember.group_id == Group.id) & (GroupMember.user_id == user_id))
            .outerjoin(last_exp_sub, last_exp_sub.c.group_id == Group.id)
            .order_by(last_exp_sub.c.last_act.desc().nullslast(), Group.created_at.desc())
            .limit(3)
        )
        
        print("SQL:", stmt)
        result = await session.execute(stmt)
        for row in result:
            print("Row:", row)

if __name__ == "__main__":
    asyncio.run(check())
