"""OpenAPI post-processing."""


def mark_response_fields_required(result, generator, request, public):
    """Serializers always render every declared field, so in response components every
    property is present (possibly null). Marking them required gives clients accurate,
    non-optional types. Request components ("...Request") keep DRF's own required list."""
    for name, component in result.get('components', {}).get('schemas', {}).items():
        if name.endswith('Request') or component.get('type') != 'object' or 'properties' not in component:
            continue
        component['required'] = sorted(component['properties'])
    return result
