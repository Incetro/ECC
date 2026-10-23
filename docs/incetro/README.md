# Incetro ECC

Incetro ECC – установщик агентного окружения поверх [ECC](https://github.com/affaan-m/ECC). Одна команда готовит репозиторий для Cursor:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
cd my-project
incetro-ecc init
```

В проекте 3 слоя:

- Файлы ECC – устанавливаются upstream ECC.
- Файлы Incetro – устанавливаются из `incetro/` и отслеживаются по хешам.
- Файлы самого проекта – установщик не редактирует.

Читайте [начало работы](getting-started.md) для первоначальной настройки. [Стандарт документации проектов](documentation.md) описывает живые README и docs, палитру Shields.io, правила тире и подключение проверок. Остальные документы объясняют команды, права на файлы, профили и синхронизацию upstream.
