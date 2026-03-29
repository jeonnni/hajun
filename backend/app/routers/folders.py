from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter()


@router.get("/folders", response_model=list[schemas.FolderResponse])
def get_folders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Folder).order_by(models.Folder.created_at.desc()).all()


@router.post("/folders", response_model=schemas.FolderResponse, status_code=201)
def create_folder(
    body: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = models.Folder(name=body.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Unlink photos from this folder
    db.query(models.Photo).filter(models.Photo.folder_id == folder_id).update(
        {models.Photo.folder_id: None}
    )
    db.delete(folder)
    db.commit()
