# Pallet Labels - Global Food Link S.L.

Aplicacion web para generar etiquetas de palet conectada directamente a Business Central.

## Arquitectura

```
┌─────────────────────┐     OData API     ┌────────────────────┐
│   Business Central  │ ◄──────────────── │   Backend (FastAPI) │
│   (Dynamics 365)    │                   │   Puerto 8000       │
└─────────────────────┘                   └────────┬───────────┘
                                                   │ /api/*
                                          ┌────────┴───────────┐
                                          │  Frontend (React)   │
                                          │  Servido por FastAPI│
                                          └────────────────────┘
                                                   │
                                          ┌────────┴───────────┐
                                          │   Navegador web     │
                                          │   del usuario       │
                                          └────────────────────┘
```

## Despliegue en el servidor (192.168.1.200)

### Paso 1: Subir los archivos

Copia la carpeta `pallet-labels` al servidor:
```bash
scp -r pallet-labels/ usuario@192.168.1.200:/opt/pallet-labels/
```

O si usas git, sube el proyecto a un repositorio y clonalo.

### Paso 2: Configurar el Backend

```bash
cd /opt/pallet-labels/backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env
```

Edita el archivo `.env` con tus credenciales de BC:
- `BC_ODATA_URL`: Tu URL base de OData (la misma que usas en Power Query)
- `BC_TOKEN`: Tu token de autenticacion OAuth2
- `WS_*`: Los nombres exactos de tus Web Services publicados en BC

### Paso 3: Construir el Frontend

```bash
cd /opt/pallet-labels/frontend

# Instalar Node.js si no esta instalado
# sudo apt install nodejs npm

npm install
npm run build
```

Esto crea la carpeta `build/` que el backend servira automaticamente.

### Paso 4: Iniciar el servidor

```bash
cd /opt/pallet-labels/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Accede desde el navegador: `http://192.168.1.200:8000`

### Paso 5: Ejecutar como servicio (para que se inicie automaticamente)

Crea el archivo de servicio:
```bash
sudo nano /etc/systemd/system/pallet-labels.service
```

Contenido:
```ini
[Unit]
Description=Pallet Labels Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pallet-labels/backend
Environment=PATH=/opt/pallet-labels/backend/venv/bin
ExecStart=/opt/pallet-labels/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Activar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pallet-labels
sudo systemctl start pallet-labels

# Verificar estado
sudo systemctl status pallet-labels

# Ver logs
sudo journalctl -u pallet-labels -f
```

## API Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/orders` | GET | Lista pedidos abiertos con pallets |
| `/api/orders/{no}` | GET | Detalle de un pedido |
| `/api/pallets` | GET | Lista pallets (filtro: `?order_no=PV000001`) |
| `/api/refresh` | POST | Limpia cache y recarga datos de BC |
| `/api/health` | GET | Estado del servicio |

## Notas importantes

- Los datos de BC se cachean 5 minutos (configurable en `.env`)
- El boton "Actualizar" en la app limpia la cache y recarga datos frescos
- Solo se muestran pallets de pedidos de venta abiertos (Inner Join)
- Solo se muestran pallets con Sales_Order_No que empiece por "PV"

## Pendientes

- [ ] Definir que EAN usar (consultar con operaciones)
- [ ] Obtener prefijo GS1 para generar SSCC
- [ ] Integrar con Label Service existente para codigos de barras reales
- [ ] Diseno final de etiqueta aprobado por cliente
