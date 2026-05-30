import httpx
from app.core.config import get_settings

settings = get_settings()


async def upload_file_to_storage(bucket: str, path: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload a file to Supabase Storage and return the public/signed path."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, content=content, headers=headers)
        response.raise_for_status()
    return path


async def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Generate a signed download URL for a private object."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json={"expiresIn": expires_in}, headers=headers)
        response.raise_for_status()
        data = response.json()
    return f"{settings.SUPABASE_URL}/storage/v1{data['signedURL']}"


async def delete_from_storage(bucket: str, path: str) -> None:
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
    async with httpx.AsyncClient() as client:
        await client.delete(url, headers=headers)
