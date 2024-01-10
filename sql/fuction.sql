CREATE OR REPLACE FUNCTION pgr_fromAtoB(
        IN tbl varchar,
        IN x1 double precision,
        IN y1 double precision,
        IN x2 double precision,
        IN y2 double precision,
        OUT seq integer,
        OUT gid integer,
        OUT name text,
        OUT heading double precision,
        OUT cost double precision,
        OUT geom geometry
    ) RETURNS SETOF record AS $BODY$
DECLARE sql text;
rec record;
source integer;
target integer;
point integer;
BEGIN -- Find nearest node
EXECUTE 'SELECT id::integer FROM roads_vertices_pgr
ORDER BY the_geom <-> ST_GeometryFromText(''POINT(' || x1 || ' ' || y1 || ')'',4326) LIMIT 1' INTO rec;
source := rec.id;
EXECUTE 'SELECT id::integer FROM roads_vertices_pgr
ORDER BY the_geom <-> ST_GeometryFromText(''POINT(' || x2 || ' ' || y2 || ')'',4326) LIMIT 1' INTO rec;
target := rec.id;
-- Shortest path query (TODO: limit extent by BBOX)
seq := 0;
sql := 'SELECT id, geom, name, cost, source, target,edge,
ST_Reverse(geom) AS flip_geom FROM ' || 'pgr_dijkstra(''SELECT id , source::int, target::int, ' || 'st_length(geom) as cost FROM ' || quote_ident(tbl) || ''', ' || source || ', ' || target || ' , false), ' || quote_ident(tbl) || ' WHERE edge = id ORDER BY seq';
-- Remember start point
point := source;
FOR rec IN EXECUTE sql LOOP -- Flip geometry (if required)
IF (point != rec.source) THEN rec.geom := rec.flip_geom;
point := rec.source;
ELSE point := rec.target;
END IF;
-- Calculate heading (simplified)
EXECUTE 'SELECT degrees( ST_Azimuth(
ST_StartPoint(''' || rec.geom::text || '''),
ST_EndPoint(''' || rec.geom::text || ''') ) )' INTO heading;
-- Return record
seq := seq + 1;
gid := rec.id;
name := rec.name;
cost := rec.cost;
geom := rec.geom;
RETURN NEXT;
END LOOP;
RETURN;
END;
$BODY$ LANGUAGE 'plpgsql' VOLATILE STRICT