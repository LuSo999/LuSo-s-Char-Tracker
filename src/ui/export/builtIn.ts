// Ready-made templates for known sheets (loaded with the export dialog only).
import { SheetTemplate } from '../../engine/export/template'
import official from '../../engine/export/templates/dnd-2024-official.json'
import gunslinger from '../../engine/export/templates/tenfootpole-gunslinger-a4.json'

export const builtInTemplates: SheetTemplate[] = [SheetTemplate.parse(official), SheetTemplate.parse(gunslinger)]
