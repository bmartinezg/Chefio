# Chefio

Chefio es un agente de cocina creado con [eve](https://eve.dev/) que ayuda a encontrar recetas adaptadas a los ingredientes, preferencias y necesidades de cada persona.

El agente investiga recetas e información culinaria en internet mediante conexiones MCP, presenta una propuesta completa y permite al usuario enviarla por correo electrónico. Además, guarda las recetas en Notion para poder consultarlas y organizarlas más adelante.

## ¿Qué hace?

- Busca y contrasta recetas, técnicas y recomendaciones culinarias.
- Adapta los ingredientes, cantidades, tiempos y pasos a las necesidades del usuario.
- Envía la receta por email después de recibir la confirmación del usuario.
- Guarda la receta en Notion.

Estas acciones se integran mediante MCPs y tools de eve: Tavily se utiliza para la búsqueda en internet, una tool gestiona el envío por correo y la integración con Notion se encarga de almacenar las recetas.
