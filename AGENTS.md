# AGENTS.md

Este repositório é o sistema operacional da **agência LOTHEM — Inteligência em Marketing**.

Qualquer agente de IA que trabalhe aqui (Claude Code, Cursor ou outro) deve:

1. Ler e seguir o `CLAUDE.md`. Ele define o Agente 0 (orquestrador) e todas as regras da agência.
2. Usar os 16 especialistas em `.claude/agents/<agente>.md` como playbooks: quando a tarefa for de um especialista, ler o arquivo dele e aplicar as regras, as referências (mundiais e brasileiras) e o formato de entrega.
3. Ler a memória do cliente em `clientes/<cliente>/` antes de criar qualquer coisa.
4. Não executar nada externo (publicar, enviar, alterar campanha, orçamento ou site) sem aprovação explícita da Rebeca.

O `CLAUDE.md` é a fonte única das regras. Este arquivo só aponta para ele.
