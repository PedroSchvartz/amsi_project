from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.login import Login
from schemas.login import LoginCreate, LoginUpdate, LoginResponse
from auth.dependencies import exige_admin
from typing import List

router = APIRouter(
    prefix="/login",
    tags=["Login"]
)

@router.get("/", response_model=List[LoginResponse])
def listar_logins(db: Session = Depends(get_db), _=Depends(exige_admin)):
    return db.query(Login).all()

@router.get("/{id_login}", response_model=LoginResponse)
def buscar_login(id_login: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    login = db.query(Login).filter(Login.id_login == id_login).first()
    if not login:
        raise HTTPException(status_code=404, detail="Login não encontrado")
    return login

@router.get("/por-usuario/{id_usuario}", response_model=List[LoginResponse])
def listar_logins_por_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    return db.query(Login).filter(Login.id_usuario_fk == id_usuario).all()

@router.post("/", response_model=LoginResponse)
def registrar_login(dados: LoginCreate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    from models.usuario import Usuario
    if not db.query(Usuario).filter(Usuario.id_usuario == dados.id_usuario_fk).first():
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    login = Login(**dados.model_dump())
    db.add(login)
    db.commit()
    db.refresh(login)
    return login

@router.put("/{id_login}", response_model=LoginResponse)
def registrar_logout(id_login: int, dados: LoginUpdate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    login = db.query(Login).filter(Login.id_login == id_login).first()
    if not login:
        raise HTTPException(status_code=404, detail="Login não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(login, campo, valor)
    db.commit()
    db.refresh(login)
    return login

@router.delete("/{id_login}")
def deletar_login(id_login: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    login = db.query(Login).filter(Login.id_login == id_login).first()
    if not login:
        raise HTTPException(status_code=404, detail="Login não encontrado")
    db.delete(login)
    db.commit()
    return {"mensagem": "Login deletado com sucesso"}