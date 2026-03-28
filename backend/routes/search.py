from fastapi import APIRouter
from pydantic import BaseModel
from services.search import search_products

router = APIRouter()


class SearchQuery(BaseModel):
    query: str


@router.post("")
async def search(body: SearchQuery):
    results = await search_products(body.query)
    return results
