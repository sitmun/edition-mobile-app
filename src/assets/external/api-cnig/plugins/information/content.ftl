<#--Template HTML para mostrar la informacion de un feature -->
<style type="text/css">
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
}
.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  padding: 1rem;
  margin-bottom: 1rem;
}
.header {
  display: flex;
  align-items: center;
  gap: 1rem; 
}
.header img {
  width: 80px;   
  height: auto;
  border-radius: 8px;
}
.card-title {
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0;
  color: black;
}
.card-content {
  padding: 0 1rem;
  text-align: justify;
  color: black;
}
</style>
<body>
<#-- Asignar idioma usando GET, con valor por defecto "ca" -->
<#assign lang = request["LANG"]!"ca">

<#list features as feature>
  <#assign attrs = {} >
  <#list feature.attributes as attribute>
    <#assign attrs = attrs + { (attribute.name) : attribute.value } >
  </#list>

  <div class="container">
    <div class="card">
      <div class="header">
        <img src="${attrs.imatge?if_exists}" />
        <#if lang == "es">
          <h5 class="card-title">${attrs.nom_es?if_exists}</h5>
        <#elseif lang == "en">
          <h5 class="card-title">${attrs.nom_en?if_exists}</h5>
        <#elseif lang == "ca">
          <h5 class="card-title">${attrs.nom_ca?if_exists}</h5>
        <#else>
          <h5 class="card-title">${attrs.nom_ca?if_exists}</h5>
        </#if>
      </div>
      <#-- Campo ejemplo -->
      <div class="card-content">
        <#if lang == "es">
          <h4>Descripción</h4>
          <div>${attrs.descrip_es?if_exists}</div>
        <#elseif lang == "en">
          <h4>Description</h4>
          <div>${attrs.descrip_en?if_exists}</div>
        <#elseif lang == "ca">
          <h4>Descripció</h4>
          <div>${attrs.descrip_ca?if_exists}</div>
        <#else>
          <h4>Descripció</h4>
          <div>${attrs.descrip_ca?if_exists}</div>
        </#if>
      </div>
      <#-- Añadir otros campos bajo esta linea. -->
    </div>
  </div>
</#list>
</body>
