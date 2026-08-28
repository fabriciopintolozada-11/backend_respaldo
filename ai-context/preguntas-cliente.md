# Banco de preguntas para el cliente — sesión 2

> El enunciado exige **al menos 15 preguntas** escritas por equipo. Este banco completo está estructurado y priorizado para **Los Fratelli / Taller Andino**, siguiendo los seis escalones metodológicos: **Contexto → Proceso → Reglas → Excepciones → Permisos → Datos**.
>
> Las respuestas textuales obtenidas durante la sesión se registran en [registro-respuestas-cliente.md](registro-respuestas-cliente.md).

## Guía de uso del banco

- 🔥 **Imprescindible:** pregunta de máxima prioridad que desbloquea reglas críticas de arquitectura, máquinas de estado o bloqueos del flujo principal.
- La columna *Resuelve / Alimenta* vincula cada pregunta con una regla de negocio (`RN-xx`), supuesto (`SUP-xx`) o épica del backlog.
- Mantener las preguntas abiertas. Ante cualquier caso borde, preguntar: **¿Y qué pasa cuando sale mal?**

---

## Escalón 1 — Contexto: ¿Quiénes son y qué hacen hoy?

### P-01
🔥 **¿Cómo está organizada la distribución del taller entre las 4 bahías, el área de recepción y el almacén de repuestos? ¿Tienen pensado expandir bahías o abrir otra sucursal?**

*Resuelve / Alimenta:* Contexto general y escalabilidad del modelo de datos (`WorkBay`, `Branch`).

### P-02
🔥 **¿Qué información inicial y qué vista necesita cada rol (Recepción, Mecánico, Jefe de Taller) apenas inicia sesión en el sistema?**

*Resuelve / Alimenta:* Dashboard y vistas iniciales por perfil (`FE-05`, `BE-02`).

### P-03
**¿Cómo manejan la prioridad de atención entre vehículos particulares, clientes frecuentes y vehículos que requieren trabajos rápidos, como cambio de aceite frente a reparación de motor?**

*Resuelve / Alimenta:* Criterios de asignación de bahías y orden en cola de espera (`RN-14`).

## Escalón 2 — Proceso: ¿Cómo lo hacen, paso a paso?

### P-04
🔥 **¿Podrían describir el ciclo de vida completo de una Orden de Trabajo (OT), desde que el auto ingresa hasta que se entrega? ¿Cuáles son todos los estados posibles?**

*Resuelve / Alimenta:* Máquina de estados de la OT (`RN-01`, `RN-02`, `RN-05`).

### P-05
🔥 **¿Cómo es el flujo exacto para solicitar, reservar y despachar un repuesto desde el almacén hacia una bahía de trabajo?**

*Resuelve / Alimenta:* `RN-07`, `RN-08`, `RN-09` (reservas frente a consumo real).

### P-06
**¿Cómo registra Recepción la aprobación del cliente sobre un presupuesto —llamada, mensaje o presencial— y qué datos deben quedar asentados?**

*Resuelve / Alimenta:* `RN-02` y auditoría de aprobaciones (`QuoteApproval`).

### P-07
**Al finalizar el trabajo, ¿cómo se liquida la cuenta del taller y qué desglose se entrega al cliente si no se emite factura fiscal?**

*Resuelve / Alimenta:* `RN-21`, `RN-22` (liquidación en BOB, repuestos y mano de obra).

## Escalón 3 — Reglas: ¿Qué está permitido y qué no?

### P-08
🔥 **¿Existe algún monto mínimo de reparación o repuesto que no requiera autorización del cliente, o todo debe ser aprobado previamente?**

*Resuelve / Alimenta:* `RN-02` (aprobación obligatoria sin monto exento).

### P-09
🔥 **¿Qué ocurre si durante una reparación el mecánico detecta fallas adicionales no presupuestadas? ¿Puede continuar con lo aprobado o debe detenerse?**

*Resuelve / Alimenta:* `RN-03` (suspensión inmediata de OT y re-cotización).

### P-10
🔥 **¿Cómo opera la garantía de 30 días tras la entrega del vehículo y qué rubros cubre exactamente: mano de obra, repuestos o ambos?**

*Resuelve / Alimenta:* `RN-11`, `RN-12`, `RN-13`.

### P-11
**¿Está permitido que un mecánico retire un repuesto del almacén si la OT aún no ha sido aprobada por el cliente?**

*Resuelve / Alimenta:* `RN-09` (bloqueo estricto de salidas no aprobadas).

### P-12
**¿Qué tipos de vehículos o tecnologías de propulsión están expresamente vetados de ingresar al taller?**

*Resuelve / Alimenta:* `RN-18` (bloqueo a vehículos 100% eléctricos).

## Escalón 4 — Excepciones: ¿Qué pasa cuando sale mal?

### P-13
🔥 **¿Qué sucede si el sistema indica que hay existencias de un repuesto pero al buscarlo físicamente el estante está vacío? ¿Cómo continúa la OT y cómo se ajusta el inventario?**

*Resuelve / Alimenta:* `RN-05` (paso a *En Espera de Repuesto* y ajuste de stock).

### P-14
🔥 **¿Qué se hace cuando un cliente no responde a la notificación de presupuesto durante días o semanas? ¿Cuánto tiempo puede permanecer el vehículo ocupando espacio?**

*Resuelve / Alimenta:* `RN-06` (alerta a los 15 días continuos sin respuesta).

### P-15
🔥 **Si un cliente rechaza el presupuesto inicial tras realizarse el diagnóstico, ¿se cobra el tiempo de diagnóstico y en qué estado queda la orden?**

*Resuelve / Alimenta:* Manejo de OT en estado *Rechazado* y cobro del diagnóstico inicial.

### P-16
**Si un vehículo reingresa por garantía después de transcurridos los 30 días reglamentarios, ¿existe alguna excepción o flujo de aprobación especial?**

*Resuelve / Alimenta:* `RN-13` (autorización requerida del Jefe de Taller).

### P-17
**¿Qué procedimiento se sigue si un repuesto instalado falla prematuramente o sale defectuoso de fábrica durante el periodo de garantía?**

*Resuelve / Alimenta:* Trazabilidad de proveedores y devolución de piezas defectuosas.

### P-18
**¿Qué pasa si un mecánico asignado se ausenta o no puede terminar una orden de trabajo en curso? ¿Quién y cómo reasigna la OT?**

*Resuelve / Alimenta:* `RN-04`, `RN-14` (reasignación por el Jefe de Taller).

## Escalón 5 — Permisos: ¿Quién puede hacer qué?

### P-19
🔥 **¿Quién tiene la facultad exclusiva de asignar mecánicos a las bahías, definir prioridades y aplicar descuentos o anulaciones sobre las cuentas?**

*Resuelve / Alimenta:* `RN-14`, `RN-15` (permisos exclusivos de `WORKSHOP_LEAD`).

### P-20
🔥 **¿Tienen los mecánicos acceso a ver los precios de venta de los repuestos o de la mano de obra en sus dispositivos?**

*Resuelve / Alimenta:* `RN-16` (ocultamiento estricto de importes a `MECHANIC`).

### P-21
🔥 **¿Cómo accede el cliente a consultar el avance de su vehículo desde la web sin necesidad de registrar un usuario o contraseña?**

*Resuelve / Alimenta:* `RN-17` (acceso público mediante placa y documento de identidad).

### P-22
**¿Puede el personal de Recepción modificar datos del cliente o del vehículo sin alterar los montos de la orden?**

*Resuelve / Alimenta:* Matriz de permisos de Recepción (`RECEPTIONIST`).

## Escalón 6 — Datos: ¿Qué hay que conservar y por cuánto tiempo?

### P-23
🔥 **¿Qué información del expediente técnico previo de un auto debe desplegarse automáticamente al digitar su placa en Recepción o Jefatura?**

*Resuelve / Alimenta:* `RN-19`, `RN-20` (historial vehicular permanente e inmediato).

### P-24
🔥 **¿Por cuánto tiempo debe conservarse el historial de servicios, repuestos sustituidos y mecánicos asignados a un vehículo? ¿Se permite el borrado físico de datos?**

*Resuelve / Alimenta:* `RN-19` (inmutabilidad del historial técnico).

### P-25
**¿Qué umbral de inactividad o tiempo sin movimiento define que un repuesto deba generar una alerta de inventario estancado?**

*Resuelve / Alimenta:* `RN-10` (alerta de repuestos sin rotación durante al menos 2 meses).

### P-26
**¿Qué reportes o métricas clave necesita consultar el Jefe de Taller para evaluar el desempeño, como mecánicos, garantías, tiempos de espera y rotación de repuestos?**

*Resuelve / Alimenta:* Métricas de productividad, control de garantías e inventario estancado.

---

## Procedimiento posterior a la sesión de entrevistas

1. Transcribir fielmente las respuestas obtenidas en [registro-respuestas-cliente.md](registro-respuestas-cliente.md).
2. Contrastar los supuestos de [supuestos.md](supuestos.md), marcándolos como `Confirmado` o `Refutado`.
3. Ajustar los criterios de aceptación Gherkin y las reglas del backlog para las User Stories afectadas.
