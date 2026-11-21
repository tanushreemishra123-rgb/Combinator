"""Dependencies shared by the v1 routers."""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.sessions.scenarios import get_scenarios_dir

ScenariosDir = Annotated[Path, Depends(get_scenarios_dir)]
