var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.Backend>("backend");

builder.Build().Run();
