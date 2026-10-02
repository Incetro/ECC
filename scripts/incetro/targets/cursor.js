'use strict';

const { EXIT, IncetroError } = require('../constants');

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function mapFile(component, file) {
  if (component.kind === 'rules') {
    return `.cursor/rules/${file.baseName}`;
  }
  if (component.kind === 'agents') {
    return `.cursor/agents/${file.baseName}`;
  }
  if (component.kind === 'skills') {
    return `.cursor/skills/${component.id}/${file.relativeInside}`;
  }
  throw new IncetroError(`Unsupported component kind: ${component.kind}`, EXIT.CONFIG);
}

function mapComponent(component) {
  if (!ID_PATTERN.test(component.id)) {
    throw new IncetroError(`Invalid component id: ${component.id}`, EXIT.CONFIG);
  }
  return component.files.map(file => ({
    id: component.id,
    kind: component.kind,
    sourceRelative: file.sourceRelative,
    sourceAbsolute: file.sourceAbsolute,
    destinationRelative: mapFile(component, file),
  }));
}

module.exports = {
  id: 'cursor',
  label: 'Cursor',
  requiredDirectory: '.cursor',
  mapComponent,
};
